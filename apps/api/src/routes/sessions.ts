import { and, desc, eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { reports, sessions } from "../db/schema.js";
import { sessionQueue } from "../queue/index.js";
import {
	getUploadUrl,
	uploadAudio,
	uploadChunk as uploadChunkToStorage,
} from "../services/storage.js";

export default async function sessionRoutes(fastify: FastifyInstance) {
	// All routes require authentication
	fastify.addHook("onRequest", fastify.authenticate);

	// GET /sessions — list recent sessions with report data
	fastify.get<{ Querystring: { limit?: string } }>("/sessions", async (request) => {
		const limit = Math.min(Math.max(Number(request.query.limit) || 3, 1), 20);

		const rows = await db
			.select({
				id: sessions.id,
				name: sessions.name,
				status: sessions.status,
				durationSeconds: sessions.durationSeconds,
				createdAt: sessions.createdAt,
				overallScore: reports.overallScore,
				cefrLevel: reports.cefrLevel,
				grammarScore: sql<number | null>`(${reports.grammarJson}->>'score')::integer`,
				vocabularyScore: sql<number | null>`(${reports.vocabularyJson}->>'score')::integer`,
				fluencyScore: sql<number | null>`(${reports.fluencyJson}->>'score')::integer`,
				businessScore: sql<number | null>`(${reports.businessEnglishJson}->>'score')::integer`,
			})
			.from(sessions)
			.leftJoin(reports, eq(sessions.id, reports.sessionId))
			.where(eq(sessions.userId, request.user.userId))
			.orderBy(desc(sessions.createdAt))
			.limit(limit);

		return rows;
	});

	// POST /sessions — create a new session
	fastify.post("/sessions", async (request) => {
		const [session] = await db
			.insert(sessions)
			.values({ userId: request.user.userId })
			.returning({ id: sessions.id, status: sessions.status, createdAt: sessions.createdAt });

		return { sessionId: session.id };
	});

	// POST /sessions/:id/upload-url — get pre-signed upload URL
	fastify.post<{ Params: { id: string } }>("/sessions/:id/upload-url", async (request, reply) => {
		const { id } = request.params;

		const [session] = await db
			.select({ id: sessions.id, status: sessions.status })
			.from(sessions)
			.where(and(eq(sessions.id, id), eq(sessions.userId, request.user.userId)));

		if (!session) {
			reply.code(404).send({ error: "Session not found" });
			return;
		}

		if (session.status !== "created") {
			reply.code(409).send({ error: `Cannot upload: session status is '${session.status}'` });
			return;
		}

		const uploadUrl = await getUploadUrl(id);

		await db
			.update(sessions)
			.set({ status: "uploading", updatedAt: new Date() })
			.where(eq(sessions.id, id));

		return { uploadUrl };
	});

	// GET /sessions/:id — get session status
	fastify.get<{ Params: { id: string } }>("/sessions/:id", async (request, reply) => {
		const { id } = request.params;

		const [session] = await db
			.select({
				id: sessions.id,
				name: sessions.name,
				status: sessions.status,
				durationSeconds: sessions.durationSeconds,
				errorMessage: sessions.errorMessage,
				createdAt: sessions.createdAt,
			})
			.from(sessions)
			.where(and(eq(sessions.id, id), eq(sessions.userId, request.user.userId)));

		if (!session) {
			reply.code(404).send({ error: "Session not found" });
			return;
		}

		return session;
	});

	// PATCH /sessions/:id — update session (e.g. rename)
	fastify.patch<{ Params: { id: string }; Body: { name: string } }>(
		"/sessions/:id",
		async (request, reply) => {
			const { id } = request.params;
			const { name } = request.body || {};

			if (typeof name !== "string") {
				reply.code(400).send({ error: "name is required" });
				return;
			}

			const trimmed = name.trim().slice(0, 255) || null;

			const [updated] = await db
				.update(sessions)
				.set({ name: trimmed, updatedAt: new Date() })
				.where(and(eq(sessions.id, id), eq(sessions.userId, request.user.userId)))
				.returning({ id: sessions.id, name: sessions.name });

			if (!updated) {
				reply.code(404).send({ error: "Session not found" });
				return;
			}

			return updated;
		},
	);

	// GET /sessions/:id/report — get the analysis report
	fastify.get<{ Params: { id: string } }>("/sessions/:id/report", async (request, reply) => {
		const { id } = request.params;

		// Verify the session belongs to the user
		const [session] = await db
			.select({ id: sessions.id, status: sessions.status })
			.from(sessions)
			.where(and(eq(sessions.id, id), eq(sessions.userId, request.user.userId)));

		if (!session) {
			reply.code(404).send({ error: "Session not found" });
			return;
		}

		if (session.status !== "complete") {
			reply.code(202).send({ status: session.status });
			return;
		}

		const [report] = await db.select().from(reports).where(eq(reports.sessionId, id));

		if (!report) {
			reply.code(404).send({ error: "Report not found" });
			return;
		}

		return {
			id: report.id,
			sessionId: report.sessionId,
			overallScore: report.overallScore,
			cefrLevel: report.cefrLevel,
			grammar: report.grammarJson,
			vocabulary: report.vocabularyJson,
			fluency: report.fluencyJson,
			businessEnglish: report.businessEnglishJson,
			tips: report.tips,
			createdAt: report.createdAt,
		};
	});

	// POST /sessions/:id/upload — direct upload: receives audio, stores in R2, triggers processing
	fastify.post<{ Params: { id: string }; Querystring: { durationSeconds?: string } }>(
		"/sessions/:id/upload",
		async (request, reply) => {
			const { id } = request.params;
			const durationSeconds = request.query.durationSeconds
				? Number(request.query.durationSeconds)
				: null;

			const [session] = await db
				.select({ id: sessions.id, status: sessions.status })
				.from(sessions)
				.where(and(eq(sessions.id, id), eq(sessions.userId, request.user.userId)));

			if (!session) {
				reply.code(404).send({ error: "Session not found" });
				return;
			}

			if (session.status !== "created") {
				reply.code(409).send({
					error: `Cannot upload: session status is '${session.status}'`,
				});
				return;
			}

			const body = await request.file();
			if (!body) {
				reply.code(400).send({ error: "No file uploaded" });
				return;
			}

			const chunks: Buffer[] = [];
			for await (const chunk of body.file) {
				chunks.push(chunk);
			}
			const buffer = Buffer.concat(chunks);

			await uploadAudio(id, buffer, body.mimetype || "audio/webm");

			await db
				.update(sessions)
				.set({
					status: "processing",
					audioUrl: `audio/${id}.webm`,
					durationSeconds,
					updatedAt: new Date(),
				})
				.where(eq(sessions.id, id));

			await sessionQueue.add("process", { sessionId: id });
			fastify.log.info({ sessionId: id }, "Session uploaded and queued for processing");

			return { status: "processing" };
		},
	);

	// POST /sessions/:id/chunks/:index — upload a single audio chunk
	fastify.post<{ Params: { id: string; index: string } }>(
		"/sessions/:id/chunks/:index",
		async (request, reply) => {
			const { id, index } = request.params;
			const chunkIndex = Number(index);

			if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
				reply.code(400).send({ error: "Invalid chunk index" });
				return;
			}

			const [session] = await db
				.select({ id: sessions.id, status: sessions.status })
				.from(sessions)
				.where(and(eq(sessions.id, id), eq(sessions.userId, request.user.userId)));

			if (!session) {
				reply.code(404).send({ error: "Session not found" });
				return;
			}

			if (session.status !== "created" && session.status !== "uploading") {
				reply.code(409).send({
					error: `Cannot upload chunk: session status is '${session.status}'`,
				});
				return;
			}

			const body = await request.file();
			if (!body) {
				reply.code(400).send({ error: "No file uploaded" });
				return;
			}

			const chunks: Buffer[] = [];
			for await (const chunk of body.file) {
				chunks.push(chunk);
			}
			const buffer = Buffer.concat(chunks);

			await uploadChunkToStorage(id, chunkIndex, buffer, body.mimetype || "audio/webm");

			// Set status to uploading on first chunk
			if (session.status === "created") {
				await db
					.update(sessions)
					.set({ status: "uploading", updatedAt: new Date() })
					.where(eq(sessions.id, id));
			}

			return { ok: true };
		},
	);

	// POST /sessions/:id/complete-recording — all chunks uploaded, trigger processing
	fastify.post<{
		Params: { id: string };
		Body: { totalChunks: number; durationSeconds?: number };
	}>("/sessions/:id/complete-recording", async (request, reply) => {
		const { id } = request.params;
		const { totalChunks, durationSeconds } = request.body || {};

		if (!Number.isInteger(totalChunks) || totalChunks < 1) {
			reply.code(400).send({ error: "totalChunks must be a positive integer" });
			return;
		}

		const [session] = await db
			.select({ id: sessions.id, status: sessions.status })
			.from(sessions)
			.where(and(eq(sessions.id, id), eq(sessions.userId, request.user.userId)));

		if (!session) {
			reply.code(404).send({ error: "Session not found" });
			return;
		}

		if (session.status !== "uploading") {
			reply.code(409).send({
				error: `Cannot complete recording: session status is '${session.status}'`,
			});
			return;
		}

		await db
			.update(sessions)
			.set({
				status: "processing",
				totalChunks,
				durationSeconds: durationSeconds ?? null,
				updatedAt: new Date(),
			})
			.where(eq(sessions.id, id));

		await sessionQueue.add("process", { sessionId: id });
		fastify.log.info({ sessionId: id }, "Chunked session queued for processing");

		return { status: "processing" };
	});

	// POST /sessions/:id/complete-upload — mark upload as done, trigger processing (legacy)
	fastify.post<{ Params: { id: string }; Body: { durationSeconds?: number } }>(
		"/sessions/:id/complete-upload",
		async (request, reply) => {
			const { id } = request.params;
			const { durationSeconds } = request.body || {};

			const [session] = await db
				.select({ id: sessions.id, status: sessions.status })
				.from(sessions)
				.where(and(eq(sessions.id, id), eq(sessions.userId, request.user.userId)));

			if (!session) {
				reply.code(404).send({ error: "Session not found" });
				return;
			}

			if (session.status !== "uploading") {
				reply.code(409).send({
					error: `Cannot complete upload: session status is '${session.status}'`,
				});
				return;
			}

			await db
				.update(sessions)
				.set({
					status: "processing",
					audioUrl: `audio/${id}.webm`,
					durationSeconds: durationSeconds ?? null,
					updatedAt: new Date(),
				})
				.where(eq(sessions.id, id));

			await sessionQueue.add("process", { sessionId: id });
			fastify.log.info({ sessionId: id }, "Session queued for processing");

			return { status: "processing" };
		},
	);
}
