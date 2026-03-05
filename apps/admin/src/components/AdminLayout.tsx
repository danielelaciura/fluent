import { LayoutDashboard, LogOut, Users } from "lucide-react";
import { NavLink, Outlet } from "react-router";
import useAuth from "../hooks/useAuth";
import { cn } from "../lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Separator } from "./ui/separator";

const navItems = [
	{ to: "/", icon: LayoutDashboard, label: "Dashboard" },
	{ to: "/users", icon: Users, label: "Users" },
];

export default function AdminLayout() {
	const { user, logout } = useAuth();

	const initials = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join("") || "A";

	return (
		<div className="flex h-screen">
			<aside className="flex w-56 flex-col border-r bg-sidebar">
				<div className="flex h-14 items-center gap-2 px-4">
					<span className="font-heading text-lg font-bold text-primary">Zest</span>
					<span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
						Admin
					</span>
				</div>

				<nav className="flex-1 space-y-1 px-2 py-2">
					{navItems.map(({ to, icon: Icon, label }) => (
						<NavLink
							key={to}
							to={to}
							end={to === "/"}
							className={({ isActive }) =>
								cn(
									"flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
									isActive
										? "bg-sidebar-accent text-sidebar-accent-foreground"
										: "text-sidebar-foreground hover:bg-sidebar-accent/50",
								)
							}
						>
							<Icon className="size-4" />
							{label}
						</NavLink>
					))}
				</nav>

				<Separator />

				<div className="p-2">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button
								type="button"
								className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent/50"
							>
								<Avatar className="size-6">
									<AvatarImage src={user?.avatarUrl ?? undefined} />
									<AvatarFallback className="text-xs">{initials}</AvatarFallback>
								</Avatar>
								<span className="truncate">
									{user?.firstName} {user?.lastName}
								</span>
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="w-48">
							<DropdownMenuItem onClick={logout}>
								<LogOut className="mr-2 size-4" />
								Sign out
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</aside>

			<main className="flex-1 overflow-y-auto p-6">
				<Outlet />
			</main>
		</div>
	);
}
