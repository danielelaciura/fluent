import "dotenv/config";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { db, sql } from "../src/db/index.js";
import { reports, sessions, userProgress, users } from "../src/db/schema.js";
import { signToken } from "../src/lib/jwt.js";

const API_URL = `http://localhost:${process.env.PORT || 3000}`;
const audioFile = process.argv.find((a) => a.endsWith(".webm"));

const TEST_USER = {
	email: "test-upload@meetfluent.dev",
	name: "Upload Test User",
	googleId: "google-upload-test-456",
};

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean) {
	if (condition) {
		passed++;
		console.log(`   PASS: ${label}`);
	} else {
		failed++;
		console.log(`   FAIL: ${label}`);
	}
}

async function api(path: string, token: string, options: RequestInit = {}) {
	const headers: Record<string, string> = {
		Authorization: `Bearer ${token}`,
		...options.headers,
	};
	if (options.body) {
		headers["Content-Type"] = "application/json";
	}
	const res = await fetch(`${API_URL}${path}`, { ...options, headers });
	const body = await res.json().catch(() => null);
	return { status: res.status, body };
}

async function run() {
	console.log("--- Test Upload Flow ---\n");

	if (audioFile) {
		console.log(`Using real audio: ${audioFile}\n`);
	} else {
		console.log("No .webm file provided, using fake audio.\n");
		console.log("  To test with Whisper transcription, run:");
		console.log("  npx tsx scripts/test-upload.ts path/to/audio.webm --keep\n");
	}

	// Setup: create test user + JWT
	console.log("0. Setup: creating test user...");
	const [user] = await db
		.insert(users)
		.values(TEST_USER)
		.onConflictDoUpdate({
			target: users.googleId,
			set: { name: TEST_USER.name, updatedAt: new Date() },
		})
		.returning();
	const token = signToken({ userId: user.id, email: user.email });
	console.log(`   User: ${user.id}\n`);

	// 1. Create session
	console.log("1. POST /sessions");
	const createRes = await api("/sessions", token, { method: "POST" });
	console.log(`   Status: ${createRes.status}`);
	assert("session created (200)", createRes.status === 200);
	assert("response has sessionId", !!createRes.body?.sessionId);
	const sessionId = createRes.body?.sessionId;
	console.log(`   Session ID: ${sessionId}\n`);

	// 2. Get upload URL
	console.log("2. POST /sessions/:id/upload-url");
	const urlRes = await api(`/sessions/${sessionId}/upload-url`, token, { method: "POST" });
	console.log(`   Status: ${urlRes.status}`);
	assert("got upload URL (200)", urlRes.status === 200);
	assert("response has uploadUrl", !!urlRes.body?.uploadUrl);
	const uploadUrl: string = urlRes.body?.uploadUrl;
	console.log(`   URL: ${uploadUrl.slice(0, 80)}...\n`);

	// 3. Upload audio via pre-signed URL
	let audioData: Buffer;
	if (audioFile) {
		audioData = readFileSync(audioFile);
		console.log(`3. PUT real audio (${(audioData.length / 1024).toFixed(1)} KB)`);
	} else {
		// Minimal WebM header — enough for R2 to accept it
		audioData = Buffer.from([
			0x1a, 0x45, 0xdf, 0xa3, 0x93, 0x42, 0x82, 0x88, 0x6d, 0x61, 0x74, 0x72, 0x6f, 0x73, 0x6b,
			0x61, 0x42, 0x87, 0x81, 0x04, 0x42, 0x85, 0x81, 0x02,
		]);
		console.log("3. PUT fake WebM audio");
	}
	const putRes = await fetch(uploadUrl, {
		method: "PUT",
		headers: { "Content-Type": "audio/webm" },
		body: audioData,
	});
	console.log(`   Status: ${putRes.status}`);
	assert("upload accepted by R2 (200)", putRes.status === 200);
	console.log();

	// 4. Complete upload
	console.log("4. POST /sessions/:id/complete-upload");
	const completeRes = await api(`/sessions/${sessionId}/complete-upload`, token, {
		method: "POST",
		body: JSON.stringify({ durationSeconds: 42 }),
	});
	console.log(`   Status: ${completeRes.status}`);
	assert("complete-upload succeeded (200)", completeRes.status === 200);
	assert("status is processing", completeRes.body?.status === "processing");
	console.log();

	// 5. Verify session in DB
	console.log("5. Verify session state in DB");
	const [dbSession] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
	console.log(`   Status: ${dbSession.status}`);
	console.log(`   Audio URL: ${dbSession.audioUrl}`);
	console.log(`   Duration: ${dbSession.durationSeconds}s`);
	assert("DB status is 'processing'", dbSession.status === "processing");
	assert("DB audioUrl is set", dbSession.audioUrl === `audio/${sessionId}.webm`);
	assert("DB durationSeconds is 42", dbSession.durationSeconds === 42);
	console.log();

	// 6. Edge cases
	console.log("6. Edge cases");
	const dupUrlRes = await api(`/sessions/${sessionId}/upload-url`, token, { method: "POST" });
	assert("duplicate upload-url returns 409", dupUrlRes.status === 409);
	const dupCompleteRes = await api(`/sessions/${sessionId}/complete-upload`, token, {
		method: "POST",
		body: JSON.stringify({}),
	});
	assert("duplicate complete-upload returns 409", dupCompleteRes.status === 409);
	const fakeId = "00000000-0000-0000-0000-000000000000";
	const notFoundRes = await api(`/sessions/${fakeId}/upload-url`, token, { method: "POST" });
	assert("non-existent session returns 404", notFoundRes.status === 404);
	const noAuthRes = await fetch(`${API_URL}/sessions`, { method: "POST" });
	assert("no auth returns 401", noAuthRes.status === 401);

	// 7. Wait for full pipeline (if real audio)
	if (audioFile) {
		console.log("\n7. Waiting for pipeline (Whisper + Claude)...");
		let finalStatus = "";
		for (let i = 0; i < 120; i++) {
			const [s] = await db
				.select({ status: sessions.status })
				.from(sessions)
				.where(eq(sessions.id, sessionId));
			finalStatus = s.status;
			if (finalStatus === "complete" || finalStatus === "error") {
				console.log(`   Session status: ${finalStatus} (after ${i + 1}s)`);
				break;
			}
			if (i % 5 === 0 && i > 0) {
				console.log(`   ... still ${finalStatus} (${i}s)`);
			}
			await new Promise((r) => setTimeout(r, 1000));
		}
		assert("pipeline completed", finalStatus === "complete");

		if (finalStatus === "complete") {
			// Check report
			const [report] = await db.select().from(reports).where(eq(reports.sessionId, sessionId));
			assert("report saved in DB", !!report);
			console.log(`\n   CEFR Level: ${report.cefrLevel}`);
			console.log(`   Overall Score: ${report.overallScore}/100`);

			const grammar = report.grammarJson as { score: number; errors: unknown[]; summary: string };
			const vocab = report.vocabularyJson as { score: number };
			const fluency = report.fluencyJson as { score: number; summary: string };
			const biz = report.businessEnglishJson as { score: number };
			const tips = report.tips as string[];

			console.log(`   Grammar: ${grammar.score}/100 — ${grammar.errors.length} errors found`);
			console.log(`   Vocabulary: ${vocab.score}/100`);
			console.log(`   Fluency: ${fluency.score}/100`);
			console.log(`   Business English: ${biz.score}/100`);
			console.log(`   Tips: ${tips.length} suggestions`);
			console.log(`\n   Grammar summary: "${grammar.summary}"`);
			console.log(`   Fluency summary: "${fluency.summary}"`);
			tips.forEach((tip, i) => console.log(`   Tip ${i + 1}: "${tip}"`));

			assert(
				"report has valid CEFR level",
				["A1", "A2", "B1", "B2", "C1", "C2"].includes(report.cefrLevel),
			);
			assert("report has scores", report.overallScore >= 0 && report.overallScore <= 100);
			assert("report has tips", tips.length >= 1);

			// Check user_progress
			const [progress] = await db
				.select()
				.from(userProgress)
				.where(eq(userProgress.sessionId, sessionId));
			assert("user_progress saved", !!progress);

			// Verify privacy cleanup
			const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
			assert("audio URL cleared (privacy)", session.audioUrl === null);
		}

		if (finalStatus === "error") {
			const [s] = await db
				.select({ errorMessage: sessions.errorMessage })
				.from(sessions)
				.where(eq(sessions.id, sessionId));
			console.log(`   Error: ${s.errorMessage}`);
		}
	}

	// Cleanup
	if (process.argv.includes("--keep")) {
		console.log("\n--keep flag set, data left in DB.");
	} else {
		await db.delete(userProgress).where(eq(userProgress.sessionId, sessionId));
		await db.delete(reports).where(eq(reports.sessionId, sessionId));
		await db.delete(sessions).where(eq(sessions.userId, user.id));
		await db.delete(users).where(eq(users.id, user.id));
		console.log("\nTest data cleaned up. Use --keep to keep it.");
	}

	// Summary
	console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
	await sql.end();
	if (failed > 0) process.exit(1);
}

run().catch(async (e) => {
	console.error("\nScript failed:", e.message);
	await sql.end();
	process.exit(1);
});
