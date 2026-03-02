import { List, LogOut, Settings } from "lucide-react";
import { Link, Outlet, useNavigate } from "react-router";
import useAuth from "../hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Separator } from "./ui/separator";

export default function Layout() {
	const { user, logout } = useAuth();
	const navigate = useNavigate();

	function handleLogout() {
		logout();
		navigate("/login", { replace: true });
	}

	return (
		<div className="flex min-h-screen bg-background">
			{/* Sidebar */}
			<aside className="no-print sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-border bg-card">
				{/* Logo */}
				<div className="px-5 py-5">
					<Link to="/" className="text-xl font-bold text-primary">
						Zest
					</Link>
				</div>

				<Separator />

				{/* Navigation */}
				<nav className="flex-1 px-3 py-4">
					<Button variant="ghost" className="w-full justify-start gap-2" asChild>
						<Link to="/">
							<List className="size-4" />
							My Sessions
						</Link>
					</Button>
				</nav>

				{/* Bottom section */}
				<div className="px-3 pb-4">
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
									<Button
										variant="ghost"
										className="w-full justify-start gap-2 px-2"
									>
										<Avatar size="sm">
											{user.avatarUrl ? (
												<AvatarImage src={user.avatarUrl} alt="avatar" />
											) : null}
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
					<Outlet />
				</div>
			</main>
		</div>
	);
}
