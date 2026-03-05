import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

declare module "fastify" {
	interface FastifyInstance {
		authenticateAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
	}
}

async function authenticateAdminPlugin(fastify: FastifyInstance) {
	fastify.decorate("authenticateAdmin", async (request: FastifyRequest, reply: FastifyReply) => {
		await fastify.authenticate(request, reply);

		if (reply.sent) return;

		if (request.user.role !== "admin") {
			reply.code(403).send({ error: "Admin access required" });
		}
	});
}

export default fp(authenticateAdminPlugin, {
	name: "authenticateAdmin",
	dependencies: ["authenticate"],
});
