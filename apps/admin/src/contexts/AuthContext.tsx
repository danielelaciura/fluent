import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { fetchApi, registerLogoutCallback } from "../lib/api";
import { clearToken, getToken, saveToken } from "../lib/auth";

export interface AdminUser {
	id: string;
	email: string;
	firstName: string | null;
	lastName: string | null;
	avatarUrl: string | null;
	role: "user" | "admin";
}

interface AuthContextValue {
	user: AdminUser | null;
	isLoading: boolean;
	login: (googleToken: string) => Promise<void>;
	logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = useState<AdminUser | null>(null);
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
				return res.json() as Promise<AdminUser>;
			})
			.then((u) => {
				if (u.role !== "admin") {
					clearToken();
					setUser(null);
				} else {
					setUser(u);
				}
			})
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

		const data = (await res.json()) as { token: string; user: AdminUser };

		if (data.user.role !== "admin") {
			throw new Error("Admin access required");
		}

		saveToken(data.token);
		setUser(data.user);
	}, []);

	return (
		<AuthContext.Provider value={{ user, isLoading, login, logout }}>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuthContext(): AuthContextValue {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuthContext must be used inside AuthProvider");
	return ctx;
}
