import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { type JwtPayload, verifyToken } from "../lib/jwt.js";

declare module "fastify" {
	interface FastifyRequest {
		user: JwtPayload;
	}
	interface FastifyInstance {
		authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
	}
}

async function authenticatePlugin(fastify: FastifyInstance) {
	fastify.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
		const header = request.headers.authorization;

		if (!header?.startsWith("Bearer ")) {
			reply.code(401).send({ error: "Missing or invalid Authorization header" });
			return;
		}

		const token = header.slice(7);

		try {
			request.user = verifyToken(token);
		} catch {
			reply.code(401).send({ error: "Invalid or expired token" });
			return;
		}
	});
}

export default fp(authenticatePlugin, { name: "authenticate" });
