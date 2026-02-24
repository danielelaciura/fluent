import "dotenv/config";
import Fastify from "fastify";

const server = Fastify({
	logger: true,
});

server.get("/health", async () => {
	return { status: "ok" };
});

const start = async () => {
	const port = Number(process.env.PORT) || 3000;
	const host = process.env.HOST || "0.0.0.0";

	await server.listen({ port, host });
};

start();
