const GOOGLE_CLIENT_ID = "166032143713-pab8ia25nb4ovsmens44al4ibj2j81bp.apps.googleusercontent.com";

const STORAGE_KEYS = {
	token: "authToken",
	user: "authUser",
} as const;

export interface AuthUser {
	id: string;
	email: string;
	firstName: string | null;
	lastName: string | null;
	avatarUrl: string | null;
}

function buildAuthUrl(redirectUri: string): string {
	const params = new URLSearchParams({
		client_id: GOOGLE_CLIENT_ID,
		response_type: "id_token",
		redirect_uri: redirectUri,
		scope: "openid email profile",
		nonce: crypto.randomUUID(),
	});
	return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function extractIdToken(redirectUrl: string): string | null {
	const fragment = new URL(redirectUrl).hash.slice(1);
	const params = new URLSearchParams(fragment);
	return params.get("id_token");
}

export async function login(): Promise<AuthUser> {
	const redirectUri = chrome.identity.getRedirectURL();
	const authUrl = buildAuthUrl(redirectUri);

	const responseUrl = await chrome.identity.launchWebAuthFlow({
		url: authUrl,
		interactive: true,
	});

	if (!responseUrl) {
		throw new Error("OAuth flow was cancelled");
	}

	const idToken = extractIdToken(responseUrl);
	if (!idToken) {
		throw new Error("No id_token in OAuth response");
	}

	const res = await fetch("http://localhost:3000/auth/google", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ idToken }),
	});

	if (!res.ok) {
		throw new Error(`Auth API error: ${res.status}`);
	}

	const data = (await res.json()) as { token: string; user: AuthUser };

	await chrome.storage.local.set({
		[STORAGE_KEYS.token]: data.token,
		[STORAGE_KEYS.user]: data.user,
	});

	return data.user;
}

export async function devLogin(): Promise<AuthUser> {
	const res = await fetch("http://localhost:3000/auth/dev", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: "{}",
	});

	if (!res.ok) {
		throw new Error(`Dev auth error: ${res.status}`);
	}

	const data = (await res.json()) as { token: string; user: AuthUser };

	await chrome.storage.local.set({
		[STORAGE_KEYS.token]: data.token,
		[STORAGE_KEYS.user]: data.user,
	});

	return data.user;
}

export async function logout(): Promise<void> {
	await chrome.storage.local.remove([STORAGE_KEYS.token, STORAGE_KEYS.user]);
}

export async function getToken(): Promise<string | null> {
	const result = await chrome.storage.local.get(STORAGE_KEYS.token);
	return (result[STORAGE_KEYS.token] as string) ?? null;
}

export async function getUser(): Promise<AuthUser | null> {
	const result = await chrome.storage.local.get(STORAGE_KEYS.user);
	return (result[STORAGE_KEYS.user] as AuthUser) ?? null;
}

export async function isLoggedIn(): Promise<boolean> {
	const token = await getToken();
	return token !== null;
}
