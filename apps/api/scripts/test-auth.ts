import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, sql } from "../src/db/index.js";
import { users } from "../src/db/schema.js";
import { signToken } from "../src/lib/jwt.js";

const API_URL = `http://localhost:${process.env.PORT || 3000}`;

const TEST_USER = {
	email: "test@meetfluent.dev",
	name: "Test User",
	googleId: "google-test-123",
};

async function run() {
	console.log("--- Test Auth Flow ---\n");

	// 1. Upsert test user
	console.log("1. Creating test user in DB...");
	const [user] = await db
		.insert(users)
		.values(TEST_USER)
		.onConflictDoUpdate({
			target: users.googleId,
			set: { name: TEST_USER.name, updatedAt: new Date() },
		})
		.returning();
	console.log(`   User created: ${user.id} (${user.email})\n`);

	// 2. Generate JWT
	console.log("2. Generating JWT...");
	const token = signToken({ userId: user.id, email: user.email });
	console.log(`   Token: ${token.slice(0, 40)}...\n`);

	// 3. GET /auth/me with valid token
	console.log("3. GET /auth/me with valid token...");
	const res = await fetch(`${API_URL}/auth/me`, {
		headers: { Authorization: `Bearer ${token}` },
	});
	const body = await res.json();
	console.log(`   Status: ${res.status}`);
	console.log("   Body:", body);

	// 4. Verify
	const ok =
		res.status === 200 &&
		body.id === user.id &&
		body.email === TEST_USER.email &&
		body.name === TEST_USER.name;

	console.log(
		`\n${ok ? "PASS" : "FAIL"}: /auth/me returned ${ok ? "correct" : "unexpected"} user data`,
	);

	// 5. GET /auth/me without token (should 401)
	console.log("\n5. GET /auth/me without token...");
	const res401 = await fetch(`${API_URL}/auth/me`);
	console.log(`   Status: ${res401.status}`);
	console.log(
		`   ${res401.status === 401 ? "PASS" : "FAIL"}: ${res401.status === 401 ? "correctly rejected" : "expected 401"}`,
	);

	// 6. GET /auth/me with bad token (should 401)
	console.log("\n6. GET /auth/me with bad token...");
	const resBad = await fetch(`${API_URL}/auth/me`, {
		headers: { Authorization: "Bearer invalid.token.here" },
	});
	console.log(`   Status: ${resBad.status}`);
	console.log(
		`   ${resBad.status === 401 ? "PASS" : "FAIL"}: ${resBad.status === 401 ? "correctly rejected" : "expected 401"}`,
	);

	// Cleanup (skip with --keep)
	if (process.argv.includes("--keep")) {
		console.log("\n--keep flag set, user left in DB.");
	} else {
		await db.delete(users).where(eq(users.googleId, TEST_USER.googleId));
		console.log("\nTest user cleaned up. Use --keep to leave it in DB.");
	}

	await sql.end();
}

run().catch((e) => {
	console.error("Script failed:", e.message);
	sql.end().then(() => process.exit(1));
});
