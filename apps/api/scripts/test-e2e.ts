/**
 * E2E smoke test — simulates the full extension flow:
 *   1. Create test user + JWT
 *   2. POST /sessions
 *   3. Get upload URL
 *   4. Upload audio to R2 via presigned URL
 *   5. Call complete-upload
 *   6. Poll GET /sessions/:id/report until ready
 *   7. Print the report
 *
 * Usage:
 *   npx tsx scripts/test-e2e.ts            # uses fixtures/test-audio.webm
 *   npx tsx scripts/test-e2e.ts path.webm  # uses custom audio file
 *
 * Requires: server running on localhost:3000, Redis running
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "../src/db/index.js";
import { reports, sessions, userProgress, users } from "../src/db/schema.js";
import { signToken } from "../src/lib/jwt.js";

// ─── Config ──────────────────────────────────────────────
const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;
const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 60; // 5 min max
const AUDIO_PATH = resolve(import.meta.dirname, process.argv[2] || "../fixtures/test-audio.webm");

const TEST_EMAIL = "e2e-test@meetfluent.dev";
const TEST_GOOGLE_ID = "e2e-test-google-id-000";

// ─── Helpers ─────────────────────────────────────────────
function log(step: string, msg: string) {
	const time = new Date().toLocaleTimeString("it-IT");
	console.log(`[${time}] ${step.padEnd(16)} ${msg}`);
}

function fatal(msg: string): never {
	console.error(`\n  FATAL: ${msg}\n`);
	process.exit(1);
}

async function api(method: string, path: string, token: string, body?: unknown) {
	const res = await fetch(`${BASE_URL}${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${token}`,
			...(body ? { "Content-Type": "application/json" } : {}),
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	const data = await res.json();
	return { status: res.status, data };
}

function printReport(report: Record<string, unknown>) {
	const g = report.grammar as Record<string, unknown>;
	const v = report.vocabulary as Record<string, unknown>;
	const f = report.fluency as Record<string, unknown>;
	const b = report.businessEnglish as Record<string, unknown>;
	const tips = report.tips as string[];

	console.log(`\n${"═".repeat(60)}`);
	console.log("  MEETFLUENT — SESSION REPORT");
	console.log("═".repeat(60));

	console.log(`\n  Overall Score:  ${report.overallScore}/100`);
	console.log(`  CEFR Level:     ${report.cefrLevel}`);

	console.log(`\n${"─".repeat(60)}`);
	console.log(`  GRAMMAR — ${g.score}/100`);
	console.log(`  ${g.summary}`);
	const errors = g.errors as Array<Record<string, string>>;
	if (errors?.length) {
		for (const e of errors) {
			console.log(`    ✗ "${e.original}" → "${e.corrected}"`);
			console.log(`      ${e.rule}: ${e.explanation}`);
		}
	}

	console.log(`\n${"─".repeat(60)}`);
	console.log(`  VOCABULARY — ${v.score}/100`);
	console.log(`  ${v.range_assessment}`);
	const overused = v.overused_words as Array<Record<string, unknown>>;
	if (overused?.length) {
		for (const w of overused) {
			console.log(
				`    "${w.word}" (×${w.count}) → try: ${(w.alternatives as string[]).join(", ")}`,
			);
		}
	}
	const goodUsage = v.good_usage as string[];
	if (goodUsage?.length) {
		console.log(`  Good usage: ${goodUsage.join(", ")}`);
	}

	console.log(`\n${"─".repeat(60)}`);
	console.log(`  FLUENCY — ${f.score}/100`);
	console.log(`  ${f.summary}`);
	const fillers = f.filler_words as Record<string, number>;
	if (fillers && Object.keys(fillers).length) {
		const fillerStr = Object.entries(fillers)
			.map(([w, c]) => `${w} (×${c})`)
			.join(", ");
		console.log(`  Filler words: ${fillerStr}`);
	}
	console.log(
		`  False starts: ${f.false_starts}  |  Incomplete sentences: ${f.incomplete_sentences}`,
	);

	console.log(`\n${"─".repeat(60)}`);
	console.log(`  BUSINESS ENGLISH — ${b.score}/100`);
	const strengths = b.strengths as string[];
	if (strengths?.length) {
		for (const s of strengths) console.log(`    ✓ ${s}`);
	}
	const improvements = b.improvements as string[];
	if (improvements?.length) {
		for (const s of improvements) console.log(`    → ${s}`);
	}

	console.log(`\n${"─".repeat(60)}`);
	console.log("  TIPS");
	for (const tip of tips) {
		console.log(`    • ${tip}`);
	}

	console.log(`\n${"═".repeat(60)}\n`);
}

// ─── Cleanup ─────────────────────────────────────────────
async function cleanup(sessionId?: string) {
	log("CLEANUP", "Removing test data...");
	try {
		if (sessionId) {
			await db.delete(reports).where(eq(reports.sessionId, sessionId));
			await db.delete(userProgress).where(eq(userProgress.sessionId, sessionId));
			await db.delete(sessions).where(eq(sessions.id, sessionId));
		}
		await db.delete(users).where(eq(users.email, TEST_EMAIL));
		log("CLEANUP", "Done");
	} catch (e) {
		log("CLEANUP", `Warning: ${(e as Error).message}`);
	}
}

// ─── Main ────────────────────────────────────────────────
async function main() {
	console.log("\n  MeetFluent E2E Smoke Test\n");

	// Verify audio file exists
	let audioBuffer: Buffer;
	try {
		audioBuffer = readFileSync(AUDIO_PATH);
		log("AUDIO", `Loaded ${AUDIO_PATH} (${(audioBuffer.length / 1024).toFixed(1)} KB)`);
	} catch {
		fatal(`Audio file not found: ${AUDIO_PATH}\nPut a .webm file in fixtures/test-audio.webm`);
	}

	// Check server is up
	try {
		const res = await fetch(`${BASE_URL}/health`);
		const data = await res.json();
		if (data.status !== "ok") fatal("Server health check failed — DB not connected?");
		log("HEALTH", "Server is up, DB connected");
	} catch {
		fatal(`Cannot reach server at ${BASE_URL}. Is it running?`);
	}

	// Step 1: Create test user + JWT
	log("1. USER", "Creating test user...");
	await cleanup(); // clean up any leftover test data

	const [user] = await db
		.insert(users)
		.values({ email: TEST_EMAIL, name: "E2E Test User", googleId: TEST_GOOGLE_ID })
		.returning();

	const token = signToken({ userId: user.id, email: user.email });
	log("1. USER", `Created user ${user.id}, JWT signed`);

	let sessionId: string | undefined;

	try {
		// Step 2: Create session
		log("2. SESSION", "POST /sessions");
		const createRes = await api("POST", "/sessions", token);
		if (createRes.status !== 200) fatal(`Create session failed: ${JSON.stringify(createRes.data)}`);
		sessionId = createRes.data.sessionId;
		log("2. SESSION", `Created session ${sessionId}`);

		// Step 3: Get upload URL
		log("3. UPLOAD URL", `POST /sessions/${sessionId}/upload-url`);
		const urlRes = await api("POST", `/sessions/${sessionId}/upload-url`, token);
		if (urlRes.status !== 200) fatal(`Get upload URL failed: ${JSON.stringify(urlRes.data)}`);
		const { uploadUrl } = urlRes.data;
		log("3. UPLOAD URL", `Got presigned URL (${uploadUrl.length} chars)`);

		// Step 4: Upload audio to R2
		log("4. UPLOAD", `Uploading ${(audioBuffer.length / 1024).toFixed(1)} KB to R2...`);
		const uploadRes = await fetch(uploadUrl, {
			method: "PUT",
			headers: { "Content-Type": "audio/webm" },
			body: audioBuffer,
		});
		if (!uploadRes.ok) fatal(`R2 upload failed: ${uploadRes.status} ${uploadRes.statusText}`);
		log("4. UPLOAD", "Audio uploaded to R2");

		// Step 5: Complete upload
		log("5. COMPLETE", `POST /sessions/${sessionId}/complete-upload`);
		const completeRes = await api("POST", `/sessions/${sessionId}/complete-upload`, token, {
			durationSeconds: Math.round(audioBuffer.length / 16000), // rough estimate
		});
		if (completeRes.status !== 200)
			fatal(`Complete upload failed: ${JSON.stringify(completeRes.data)}`);
		log("5. COMPLETE", "Session queued for processing");

		// Step 6: Poll for report
		log("6. POLL", "Waiting for report...");
		let attempt = 0;

		while (attempt < MAX_POLL_ATTEMPTS) {
			attempt++;
			const reportRes = await api("GET", `/sessions/${sessionId}/report`, token);

			if (reportRes.status === 200) {
				log("6. POLL", `Report ready! (after ${(attempt * POLL_INTERVAL_MS) / 1000}s)`);

				// Step 7: Print report
				printReport(reportRes.data);
				break;
			}

			if (reportRes.status === 202) {
				const status = reportRes.data.status;
				log(
					"6. POLL",
					`Status: ${status} — retrying in ${POLL_INTERVAL_MS / 1000}s... (${attempt}/${MAX_POLL_ATTEMPTS})`,
				);
			} else if (reportRes.status === 404 && reportRes.data.error === "Session not found") {
				fatal(`Session ${sessionId} not found`);
			} else {
				log(
					"6. POLL",
					`Unexpected response: ${reportRes.status} ${JSON.stringify(reportRes.data)}`,
				);
			}

			await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
		}

		if (attempt >= MAX_POLL_ATTEMPTS) {
			fatal(`Timed out waiting for report after ${(MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s`);
		}
	} finally {
		// Always clean up
		await cleanup(sessionId);
	}
}

main().catch((err) => {
	console.error("\nUnhandled error:", err);
	process.exit(1);
});
