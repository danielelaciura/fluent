import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { subscriptions, users } from "../db/schema.js";
import { verifyGoogleToken } from "../lib/google.js";
import { signToken } from "../lib/jwt.js";

async function ensureSubscription(userId: string) {
	const [existing] = await db
		.select({ id: subscriptions.id })
		.from(subscriptions)
		.where(eq(subscriptions.userId, userId));

	if (!existing) {
		const now = new Date();
		await db.insert(subscriptions).values({
			userId,
			planId: "free",
			status: "active",
			currentPeriodStart: now,
			currentPeriodEnd: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
		});
	}
}

export default async function authRoutes(fastify: FastifyInstance) {
	fastify.post<{ Body: { idToken: string } }>("/auth/google", async (request, reply) => {
		const { idToken } = request.body;

		if (!idToken) {
			reply.code(400).send({ error: "idToken is required" });
			return;
		}

		const googleUser = await verifyGoogleToken(idToken);

		const [user] = await db
			.insert(users)
			.values({
				email: googleUser.email,
				firstName: googleUser.firstName,
				lastName: googleUser.lastName,
				avatarUrl: googleUser.avatarUrl,
				googleId: googleUser.googleId,
			})
			.onConflictDoUpdate({
				target: users.googleId,
				set: {
					email: googleUser.email,
					firstName: googleUser.firstName,
					lastName: googleUser.lastName,
					avatarUrl: googleUser.avatarUrl,
					updatedAt: new Date(),
				},
			})
			.returning();

		await ensureSubscription(user.id);
		const token = signToken({ userId: user.id, email: user.email });

		return {
			token,
			user: {
				id: user.id,
				email: user.email,
				firstName: user.firstName,
				lastName: user.lastName,
				avatarUrl: user.avatarUrl,
			},
		};
	});

	// Dev-only login — creates a test user without Google OAuth
	fastify.post("/auth/dev", async (_request, reply) => {
		if (process.env.NODE_ENV === "production") {
			reply.code(404).send({ error: "Not found" });
			return;
		}

		const [user] = await db
			.insert(users)
			.values({
				email: "dev@meetfluent.local",
				firstName: "Dev",
				lastName: "User",
				googleId: "dev-local-testing",
			})
			.onConflictDoUpdate({
				target: users.googleId,
				set: { updatedAt: new Date() },
			})
			.returning();

		await ensureSubscription(user.id);
		const token = signToken({ userId: user.id, email: user.email });

		return {
			token,
			user: {
				id: user.id,
				email: user.email,
				firstName: user.firstName,
				lastName: user.lastName,
				avatarUrl: user.avatarUrl,
			},
		};
	});

	fastify.get("/auth/me", { onRequest: [fastify.authenticate] }, async (request) => {
		const [user] = await db
			.select({
				id: users.id,
				email: users.email,
				firstName: users.firstName,
				lastName: users.lastName,
				avatarUrl: users.avatarUrl,
				createdAt: users.createdAt,
			})
			.from(users)
			.where(eq(users.id, request.user.userId));

		if (!user) {
			throw { statusCode: 404, message: "User not found" };
		}

		return user;
	});
}
