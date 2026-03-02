import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { fetchApi, registerLogoutCallback } from "../lib/api";
import { clearToken, getToken, saveToken } from "../lib/auth";

export interface User {
	id: string;
	email: string;
	firstName: string | null;
	lastName: string | null;
	avatarUrl: string | null;
}

interface AuthContextValue {
	user: User | null;
	isLoading: boolean;
	login: (googleToken: string) => Promise<void>;
	logout: () => void;
	updateUser: (partial: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = useState<User | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const logoutRef = useRef<() => void>(() => {});

	const logout = useCallback(() => {
		clearToken();
		setUser(null);
	}, []);

	logoutRef.current = logout;

	useEffect(() => {
		registerLogoutCallback(() => logoutRef.current());
	}, []);

	useEffect(() => {
		const token = getToken();
		if (!token) {
			setIsLoading(false);
			return;
		}

		fetchApi("/auth/me")
			.then((res) => {
				if (!res.ok) throw new Error("Invalid session");
				return res.json() as Promise<User>;
			})
			.then((u) => setUser(u))
			.catch(() => clearToken())
			.finally(() => setIsLoading(false));
	}, []);

	const login = useCallback(async (googleToken: string) => {
		const res = await fetchApi("/auth/google", {
			method: "POST",
			body: JSON.stringify({ idToken: googleToken }),
		});

		if (!res.ok) {
			const err = (await res.json()) as { error?: string };
			throw new Error(err.error ?? "Login failed");
		}

		const data = (await res.json()) as { token: string; user: User };
		saveToken(data.token);
		setUser(data.user);
	}, []);

	const updateUser = useCallback((partial: Partial<User>) => {
		setUser((prev) => (prev ? { ...prev, ...partial } : prev));
	}, []);

	return (
		<AuthContext.Provider value={{ user, isLoading, login, logout, updateUser }}>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuthContext(): AuthContextValue {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuthContext must be used inside AuthProvider");
	return ctx;
}
