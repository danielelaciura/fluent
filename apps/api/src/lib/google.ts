import { OAuth2Client } from "google-auth-library";

let client: OAuth2Client | null = null;
let clientId: string;

function getClient(): OAuth2Client {
	if (!client) {
		clientId = process.env.GOOGLE_CLIENT_ID || "";
		if (!clientId) {
			throw new Error("GOOGLE_CLIENT_ID environment variable is not set");
		}
		client = new OAuth2Client(clientId);
	}
	return client;
}

export interface GoogleUserInfo {
	googleId: string;
	email: string;
	firstName: string | undefined;
	lastName: string | undefined;
	avatarUrl: string | undefined;
}

export async function verifyGoogleToken(idToken: string): Promise<GoogleUserInfo> {
	const ticket = await getClient().verifyIdToken({
		idToken,
		audience: clientId,
	});

	const payload = ticket.getPayload();

	if (!payload || !payload.sub || !payload.email) {
		throw new Error("Invalid Google token payload");
	}

	return {
		googleId: payload.sub,
		email: payload.email,
		firstName: payload.given_name,
		lastName: payload.family_name,
		avatarUrl: payload.picture,
	};
}
