import { getToken } from "./auth.js";

const API_BASE = "http://localhost:3000";

export async function apiCall<T>(method: string, path: string, body?: unknown): Promise<T> {
	const token = await getToken();
	if (!token) {
		throw new Error("Not authenticated");
	}

	const headers: Record<string, string> = {
		Authorization: `Bearer ${token}`,
	};
	if (body !== undefined) {
		headers["Content-Type"] = "application/json";
	}

	const res = await fetch(`${API_BASE}${path}`, {
		method,
		headers,
		body: body !== undefined ? JSON.stringify(body) : undefined,
	});

	if (!res.ok) {
		throw new Error(`API error: ${res.status} ${res.statusText}`);
	}

	return res.json() as Promise<T>;
}

export interface RecentSession {
	id: string;
	status: string;
	durationSeconds: number | null;
	createdAt: string;
	overallScore: number | null;
	cefrLevel: string | null;
}

export async function listSessions(limit = 3): Promise<RecentSession[]> {
	return apiCall("GET", `/sessions?limit=${limit}`);
}

export async function getSession(sessionId: string): Promise<{ id: string; status: string }> {
	return apiCall("GET", `/sessions/${sessionId}`);
}

export async function createSession(): Promise<{ sessionId: string }> {
	return apiCall("POST", "/sessions");
}

export async function uploadSession(
	sessionId: string,
	blob: Blob,
	durationSeconds: number,
): Promise<void> {
	const token = await getToken();
	if (!token) {
		throw new Error("Not authenticated");
	}

	const form = new FormData();
	form.append("file", blob, "audio.webm");

	const res = await fetch(
		`${API_BASE}/sessions/${sessionId}/upload?durationSeconds=${durationSeconds}`,
		{
			method: "POST",
			headers: { Authorization: `Bearer ${token}` },
			body: form,
		},
	);

	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(`Upload error: ${res.status} ${text}`);
	}
}

export async function uploadChunk(
	sessionId: string,
	chunkIndex: number,
	blob: Blob,
): Promise<void> {
	const token = await getToken();
	if (!token) {
		throw new Error("Not authenticated");
	}

	const form = new FormData();
	form.append("file", blob, `chunk-${chunkIndex}.webm`);

	const res = await fetch(`${API_BASE}/sessions/${sessionId}/chunks/${chunkIndex}`, {
		method: "POST",
		headers: { Authorization: `Bearer ${token}` },
		body: form,
	});

	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(`Chunk upload error: ${res.status} ${text}`);
	}
}

export async function completeRecording(
	sessionId: string,
	totalChunks: number,
	durationSeconds: number,
): Promise<void> {
	await apiCall("POST", `/sessions/${sessionId}/complete-recording`, {
		totalChunks,
		durationSeconds,
	});
}
