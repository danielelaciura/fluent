import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";

interface PatchUserBody {
	firstName?: string;
	lastName?: string;
}

export default async function userRoutes(fastify: FastifyInstance) {
	fastify.addHook("onRequest", fastify.authenticate);

	fastify.patch<{ Body: PatchUserBody }>("/users/me", async (request, reply) => {
		const { firstName, lastName } = request.body;

		if (firstName !== undefined && firstName.trim() === "") {
			reply.code(400).send({ error: "firstName cannot be empty" });
			return;
		}
		if (lastName !== undefined && lastName.trim() === "") {
			reply.code(400).send({ error: "lastName cannot be empty" });
			return;
		}

		const [user] = await db
			.update(users)
			.set({
				...(firstName !== undefined ? { firstName: firstName.trim() } : {}),
				...(lastName !== undefined ? { lastName: lastName.trim() } : {}),
				updatedAt: new Date(),
			})
			.where(eq(users.id, request.user.userId))
			.returning({
				id: users.id,
				email: users.email,
				firstName: users.firstName,
				lastName: users.lastName,
				avatarUrl: users.avatarUrl,
				subscriptionTier: users.subscriptionTier,
				createdAt: users.createdAt,
			});

		if (!user) {
			reply.code(404).send({ error: "User not found" });
			return;
		}

		return user;
	});
}
