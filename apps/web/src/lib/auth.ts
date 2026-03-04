const SESSION_KEY = "mf_jwt";

export function saveToken(token: string): void {
	localStorage.setItem(SESSION_KEY, token);
}

export function getToken(): string | null {
	return localStorage.getItem(SESSION_KEY);
}

export function clearToken(): void {
	localStorage.removeItem(SESSION_KEY);
}
