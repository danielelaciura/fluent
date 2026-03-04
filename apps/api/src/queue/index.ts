import { Queue, Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { reports, sessions, transcriptions, userProgress } from "../db/schema.js";
import { analyzeTranscription } from "../services/analysis.js";
import {
	deleteAudio,
	deleteSessionChunks,
	downloadAudio,
	downloadChunk,
} from "../services/storage.js";
import { type TranscriptionResult, transcribeAudio } from "../services/transcription.js";
import { redisConnection } from "./redis.js";

export interface SessionJobData {
	sessionId: string;
}

export const sessionQueue = new Queue<SessionJobData>("session-processing", {
	connection: redisConnection,
});

export function startWorker() {
	const worker = new Worker<SessionJobData>(
		"session-processing",
		async (job) => {
			const { sessionId } = job.data;
			console.log(`[worker] Processing session ${sessionId}`);

			// Get session to find userId and totalChunks
			const [session] = await db
				.select({ userId: sessions.userId, totalChunks: sessions.totalChunks })
				.from(sessions)
				.where(eq(sessions.id, sessionId));

			if (!session) {
				throw new Error(`Session ${sessionId} not found`);
			}

			// Update status to processing
			await db
				.update(sessions)
				.set({ status: "processing", updatedAt: new Date() })
				.where(eq(sessions.id, sessionId));

			let transcription: TranscriptionResult;

			if (session.totalChunks != null) {
				// ─── Chunked flow ─────────────────────────────────
				console.log(`[worker] Chunked session: ${session.totalChunks} chunks`);
				const chunkTranscriptions: TranscriptionResult[] = [];

				for (let i = 0; i < session.totalChunks; i++) {
					console.log(`[worker] Downloading chunk ${i}`);
					const chunkBuffer = await downloadChunk(sessionId, i);
					console.log(
						`[worker] Chunk ${i}: ${(chunkBuffer.length / 1024).toFixed(1)} KB`,
					);

					console.log(`[worker] Transcribing chunk ${i}`);
					const chunkResult = await transcribeAudio(chunkBuffer);
					console.log(
						`[worker] Chunk ${i}: ${chunkResult.words.length} words`,
					);
					chunkTranscriptions.push(chunkResult);
				}

				// Merge transcriptions with offset timestamps
				const mergedText: string[] = [];
				const mergedWords: TranscriptionResult["words"] = [];
				let timeOffset = 0;

				for (const chunk of chunkTranscriptions) {
					mergedText.push(chunk.text);
					for (const word of chunk.words) {
						mergedWords.push({
							word: word.word,
							start: word.start + timeOffset,
							end: word.end + timeOffset,
						});
					}
					// Use the last word's end time as the chunk duration for offset
					if (chunk.words.length > 0) {
						timeOffset += chunk.words[chunk.words.length - 1].end;
					}
				}

				transcription = {
					text: mergedText.join(" "),
					words: mergedWords,
				};

				// Delete chunks from R2
				await deleteSessionChunks(sessionId, session.totalChunks);
				console.log("[worker] Chunks deleted from R2");
			} else {
				// ─── Legacy single-file flow ─────────────────────
				console.log("[worker] Legacy single-file session");
				const audioBuffer = await downloadAudio(sessionId);
				console.log(
					`[worker] Downloaded ${(audioBuffer.length / 1024).toFixed(1)} KB`,
				);

				transcription = await transcribeAudio(audioBuffer);

				await deleteAudio(sessionId);
				console.log("[worker] Audio deleted from R2");
			}

			console.log(`[worker] Transcribed: ${transcription.words.length} words`);

			// Save transcription
			await db.insert(transcriptions).values({
				sessionId,
				fullText: transcription.text,
				wordsJson: transcription.words,
			});

			await db
				.update(sessions)
				.set({ status: "transcribed", updatedAt: new Date() })
				.where(eq(sessions.id, sessionId));

			// Analyze with Claude
			console.log("[worker] Analyzing with Claude");
			const analysis = await analyzeTranscription(transcription.text);
			console.log(
				`[worker] Analysis complete: ${analysis.cefr_level} (${analysis.overall_score}/100)`,
			);

			// Save report
			await db.insert(reports).values({
				sessionId,
				overallScore: analysis.overall_score,
				cefrLevel: analysis.cefr_level as "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
				grammarJson: analysis.grammar,
				vocabularyJson: analysis.vocabulary,
				fluencyJson: analysis.fluency,
				businessEnglishJson: analysis.business_english,
				tips: analysis.tips,
			});

			// Save progress snapshot
			const today = new Date().toISOString().split("T")[0];
			await db.insert(userProgress).values({
				userId: session.userId,
				sessionId,
				date: today,
				overallScore: analysis.overall_score,
				grammarScore: analysis.grammar.score,
				vocabularyScore: analysis.vocabulary.score,
				fluencyScore: analysis.fluency.score,
			});

			// Mark complete
			await db
				.update(sessions)
				.set({ status: "complete", audioUrl: null, updatedAt: new Date() })
				.where(eq(sessions.id, sessionId));

			console.log(`[worker] Session ${sessionId} complete`);
		},
		{ connection: redisConnection },
	);

	worker.on("failed", (job, err) => {
		const sessionId = job?.data?.sessionId ?? "unknown";
		console.error(`[worker] Job ${job?.id} failed (session ${sessionId}):`, err.message);

		db.update(sessions)
			.set({
				status: "error",
				errorMessage: err.message.slice(0, 1024),
				updatedAt: new Date(),
			})
			.where(eq(sessions.id, sessionId))
			.catch((e) => console.error("[worker] Failed to update error status:", e.message));
	});

	return worker;
}
