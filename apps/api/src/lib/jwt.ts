import jwt from "jsonwebtoken";

function getSecret(): string {
	const secret = process.env.JWT_SECRET;
	if (!secret) {
		throw new Error("JWT_SECRET environment variable is not set");
	}
	return secret;
}

export interface JwtPayload {
	userId: string;
	email: string;
	role: "user" | "admin";
}

export function signToken(payload: JwtPayload): string {
	return jwt.sign(payload, getSecret(), { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload {
	return jwt.verify(token, getSecret()) as unknown as JwtPayload;
}
