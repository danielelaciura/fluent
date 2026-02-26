import { Queue, Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { reports, sessions, transcriptions, userProgress } from "../db/schema.js";
import { analyzeTranscription } from "../services/analysis.js";
import { deleteAudio, downloadAudio } from "../services/storage.js";
import { transcribeAudio } from "../services/transcription.js";
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

			// Get session to find userId
			const [session] = await db
				.select({ userId: sessions.userId })
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

			// Step 1: Download audio from R2
			console.log("[worker] Downloading audio");
			const audioBuffer = await downloadAudio(sessionId);
			console.log(`[worker] Downloaded ${(audioBuffer.length / 1024).toFixed(1)} KB`);

			// Step 2: Transcribe with Whisper
			console.log("[worker] Transcribing");
			const transcription = await transcribeAudio(audioBuffer);
			console.log(`[worker] Transcribed: ${transcription.words.length} words`);

			// Step 3: Save transcription
			await db.insert(transcriptions).values({
				sessionId,
				fullText: transcription.text,
				wordsJson: transcription.words,
			});

			await db
				.update(sessions)
				.set({ status: "transcribed", updatedAt: new Date() })
				.where(eq(sessions.id, sessionId));

			// Step 4: Analyze with Claude
			console.log("[worker] Analyzing with Claude");
			const analysis = await analyzeTranscription(transcription.text);
			console.log(
				`[worker] Analysis complete: ${analysis.cefr_level} (${analysis.overall_score}/100)`,
			);

			// Step 5: Save report
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

			// Step 6: Save progress snapshot
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

			// Step 7: Delete transcription (privacy) and audio from R2
			await db.delete(transcriptions).where(eq(transcriptions.sessionId, sessionId));
			console.log("[worker] Transcription deleted (privacy)");

			await deleteAudio(sessionId);
			console.log("[worker] Audio deleted from R2");

			// Step 8: Mark complete
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
