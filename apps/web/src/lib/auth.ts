const SESSION_KEY = "mf_jwt";

export function saveToken(token: string): void {
	sessionStorage.setItem(SESSION_KEY, token);
}

export function getToken(): string | null {
	return sessionStorage.getItem(SESSION_KEY);
}

export function clearToken(): void {
	sessionStorage.removeItem(SESSION_KEY);
}
