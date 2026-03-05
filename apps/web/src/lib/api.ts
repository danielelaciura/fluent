import { getToken } from "./auth";

type LogoutCallback = () => void;

let onUnauthorized: LogoutCallback | null = null;

export function registerLogoutCallback(cb: LogoutCallback): void {
	onUnauthorized = cb;
}

export async function fetchApi(path: string, options?: RequestInit): Promise<Response> {
	const token = getToken();

	const hasBody = options?.body != null;

	const response = await fetch(`/api${path}`, {
		...options,
		headers: {
			...(hasBody ? { "Content-Type": "application/json" } : {}),
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...options?.headers,
		},
	});

	if (response.status === 401) {
		onUnauthorized?.();
	}

	return response;
}
