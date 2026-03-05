import "dotenv/config";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { sql } from "./db/index.js";
import authenticate from "./plugins/authenticate.js";
import authenticateAdmin from "./plugins/authenticateAdmin.js";
import { startWorker } from "./queue/index.js";
import adminRoutes from "./routes/admin.js";
import authRoutes from "./routes/auth.js";
import sessionRoutes from "./routes/sessions.js";
import subscriptionRoutes from "./routes/subscriptions.js";
import userRoutes from "./routes/users.js";

const server = Fastify({
	logger: true,
});

server.register(multipart, { limits: { fileSize: 200 * 1024 * 1024 } }); // 200 MB
server.register(authenticate);
server.register(authenticateAdmin);
server.register(adminRoutes);
server.register(authRoutes);
server.register(sessionRoutes);
server.register(subscriptionRoutes);
server.register(userRoutes);

server.get("/health", async (_request, reply) => {
	try {
		await sql`SELECT 1`;
		return { status: "ok", db: "connected" };
	} catch (error) {
		reply.code(503);
		return { status: "error", db: "disconnected" };
	}
});

const start = async () => {
	const port = Number(process.env.PORT) || 3000;
	const host = process.env.HOST || "0.0.0.0";

	await server.listen({ port, host });

	startWorker();
	server.log.info("Session processing worker started");
};

start();
