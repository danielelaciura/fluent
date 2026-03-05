import { ChevronRight, CreditCard, List, LogOut, Settings } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate, useOutletContext } from "react-router";
import useAuth from "../hooks/useAuth";
import { fetchApi } from "../lib/api";
import { scoreColor } from "../lib/format";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Separator } from "./ui/separator";

interface SidebarSession {
	id: string;
	name: string | null;
	status: string;
	createdAt: string;
	overallScore: number | null;
}

function formatShortDate(date: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "numeric",
	}).format(new Date(date));
}

export default function Layout() {
	const { user, logout } = useAuth();
	const navigate = useNavigate();
	const location = useLocation();
	const [sessions, setSessions] = useState<SidebarSession[]>([]);

	const fetchSessions = useCallback(async () => {
		const res = await fetchApi("/sessions?limit=10");
		if (res.ok) setSessions((await res.json()) as SidebarSession[]);
	}, []);

	useEffect(() => {
		fetchSessions();
	}, [fetchSessions]);

	function handleLogout() {
		logout();
		navigate("/login", { replace: true });
	}

	const activeSessionId = location.pathname.match(/^\/sessions\/(.+)/)?.[1];

	return (
		<div className="flex min-h-screen bg-background">
			{/* Sidebar */}
			<aside className="no-print sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-border bg-card">
				{/* Logo */}
				<div className="px-5 py-5">
					<Link to="/">
						<img src="/zest-logo.png" alt="Zest" className="h-7 w-auto" />
					</Link>
				</div>

				<Separator />

				{/* Navigation */}
				<nav className="flex min-h-0 flex-1 flex-col px-3 py-4">
					<Button variant="ghost" className="w-full justify-start gap-2" asChild>
						<Link to="/">
							<List className="size-4" />
							My Sessions
						</Link>
					</Button>

					{/* Recent sessions list */}
					{sessions.length > 0 && (
						<div className="mt-2 flex min-h-0 flex-1 flex-col">
							<div className="flex-1 space-y-0.5 overflow-y-auto">
								{sessions.map((s) => {
									const isActive = s.id === activeSessionId;
									const isComplete = s.status === "complete";
									const isError = s.status === "error";
									return (
										<Link
											key={s.id}
											to={`/sessions/${s.id}`}
											className={`flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted ${
												isActive ? "bg-muted font-medium" : ""
											}`}
										>
											<div className="min-w-0">
												<h5
													className={`truncate text-xs font-medium ${s.name ? "" : "text-muted-foreground"}`}
												>
													{s.name || "Untitled"}
												</h5>
												<p className="truncate text-[10px] text-muted-foreground">
													{formatShortDate(s.createdAt)}
													{isComplete && s.overallScore !== null ? (
														<span> · {s.overallScore}/100</span>
													) : isError ? (
														<span className="text-destructive"> · Failed</span>
													) : (
														<span className="text-yellow-600"> · Processing…</span>
													)}
												</p>
											</div>
											{isActive && (
												<ChevronRight className="size-3 shrink-0 text-muted-foreground" />
											)}
										</Link>
									);
								})}
								<Link
									to="/"
									className="mt-2 block text-center text-xs text-muted-foreground hover:text-foreground hover:underline"
								>
									View all sessions
								</Link>
							</div>
						</div>
					)}
				</nav>

				{/* Bottom section */}
				<div className="px-3 pb-4">
					<Button variant="ghost" className="w-full justify-start gap-2" asChild>
						<Link to="/subscription">
							<CreditCard className="size-4" />
							Plan
						</Link>
					</Button>
					<Button variant="ghost" className="w-full justify-start gap-2" asChild>
						<Link to="/profile">
							<Settings className="size-4" />
							Settings
						</Link>
					</Button>

					{user && (
						<>
							<Separator className="my-3" />
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="ghost" className="w-full justify-start gap-2 px-2">
										<Avatar size="sm">
											{user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="avatar" /> : null}
											<AvatarFallback>
												{(user.firstName?.[0] ?? user.email[0]).toUpperCase()}
											</AvatarFallback>
										</Avatar>
										<span className="truncate text-sm">
											{user.firstName
												? `${user.firstName} ${user.lastName ?? ""}`.trim()
												: user.email}
										</span>
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent side="top" align="start">
									<DropdownMenuItem variant="destructive" onClick={handleLogout}>
										<LogOut />
										Sign out
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</>
					)}
				</div>
			</aside>

			{/* Main content */}
			<main className="flex-1 overflow-y-auto px-8 py-8">
				<div className="mx-auto max-w-5xl">
					<Outlet context={{ refreshSessions: fetchSessions }} />
				</div>
			</main>
		</div>
	);
}

interface LayoutContext {
	refreshSessions: () => Promise<void>;
}

const NOOP_CONTEXT: LayoutContext = { refreshSessions: async () => {} };

export function useLayoutContext() {
	return useOutletContext<LayoutContext>() ?? NOOP_CONTEXT;
}
