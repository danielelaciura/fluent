import { ArrowLeft, Shield, ShieldOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import LoadingSpinner from "../components/LoadingSpinner";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "../components/ui/table";
import { fetchApi } from "../lib/api";
import { formatDate, formatDuration, formatUsageDuration, usageBarColor } from "../lib/format";

interface SessionRow {
	id: string;
	name: string | null;
	durationSeconds: number | null;
	status: string;
	createdAt: string;
}

interface UserDetail {
	id: string;
	email: string;
	firstName: string | null;
	lastName: string | null;
	avatarUrl: string | null;
	role: string;
	createdAt: string;
	subscription: {
		id: string;
		planId: string;
		planName: string;
		status: string;
		currentPeriodStart: string;
		currentPeriodEnd: string;
	} | null;
	usage: {
		plan: { id: string; name: string; maxSeconds: number; periodType: string };
		usedSeconds: number;
		remainingSeconds: number;
		percentUsed: number;
		isLimitReached: boolean;
	} | null;
	recentSessions: SessionRow[];
}

interface Plan {
	id: string;
	name: string;
	maxSeconds: number;
	periodType: string;
	priceCents: number;
}

export default function UserDetailPage() {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const [user, setUser] = useState<UserDetail | null>(null);
	const [plans, setPlans] = useState<Plan[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedPlan, setSelectedPlan] = useState("");
	const [actionLoading, setActionLoading] = useState(false);

	useEffect(() => {
		Promise.all([
			fetchApi(`/admin/users/${id}`).then((r) => r.json() as Promise<UserDetail>),
			fetchApi("/plans").then((r) => r.json() as Promise<{ plans: Plan[] }>),
		])
			.then(([userData, plansData]) => {
				setUser(userData);
				setPlans(plansData.plans);
				setSelectedPlan(userData.subscription?.planId ?? "");
			})
			.finally(() => setLoading(false));
	}, [id]);

	async function handleChangePlan() {
		if (!selectedPlan || selectedPlan === user?.subscription?.planId) return;
		setActionLoading(true);
		try {
			const res = await fetchApi(`/admin/users/${id}/subscription`, {
				method: "POST",
				body: JSON.stringify({ planId: selectedPlan }),
			});
			if (!res.ok) {
				const err = (await res.json()) as { error: string };
				throw new Error(err.error);
			}
			toast.success("Plan updated");
			// Reload user
			const updated = (await fetchApi(`/admin/users/${id}`).then((r) => r.json())) as UserDetail;
			setUser(updated);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to update plan");
		} finally {
			setActionLoading(false);
		}
	}

	async function handleToggleRole() {
		if (!user) return;
		const newRole = user.role === "admin" ? "user" : "admin";
		const confirmed = window.confirm(
			`Change role from "${user.role}" to "${newRole}" for ${user.email}?`,
		);
		if (!confirmed) return;

		setActionLoading(true);
		try {
			const res = await fetchApi(`/admin/users/${id}`, {
				method: "PATCH",
				body: JSON.stringify({ role: newRole }),
			});
			if (!res.ok) {
				const err = (await res.json()) as { error: string };
				throw new Error(err.error);
			}
			toast.success(`Role changed to ${newRole}`);
			setUser((prev) => (prev ? { ...prev, role: newRole } : prev));
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to update role");
		} finally {
			setActionLoading(false);
		}
	}

	if (loading) return <LoadingSpinner />;
	if (!user) return <p className="text-muted-foreground">User not found.</p>;

	const initials = [user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join("") || "?";

	return (
		<div className="space-y-6">
			<Button variant="ghost" size="sm" onClick={() => navigate("/users")}>
				<ArrowLeft className="mr-1 size-4" />
				Back to users
			</Button>

			{/* Header */}
			<div className="flex items-center gap-4">
				<Avatar className="size-14">
					<AvatarImage src={user.avatarUrl ?? undefined} />
					<AvatarFallback>{initials}</AvatarFallback>
				</Avatar>
				<div>
					<h1 className="font-heading text-2xl font-bold">
						{user.firstName} {user.lastName}
					</h1>
					<p className="text-muted-foreground">{user.email}</p>
					<div className="mt-1 flex items-center gap-2">
						<Badge variant={user.role === "admin" ? "default" : "outline"}>{user.role}</Badge>
						<span className="text-xs text-muted-foreground">
							Joined {formatDate(user.createdAt)}
						</span>
					</div>
				</div>
			</div>

			{/* Subscription + Usage */}
			<div className="grid gap-4 md:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle className="text-base">Subscription</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						{user.subscription ? (
							<>
								<div className="flex items-center justify-between">
									<span className="text-sm text-muted-foreground">Plan</span>
									<Badge variant="outline">{user.subscription.planName}</Badge>
								</div>
								<div className="flex items-center justify-between">
									<span className="text-sm text-muted-foreground">Status</span>
									<Badge variant={user.subscription.status === "active" ? "default" : "secondary"}>
										{user.subscription.status}
									</Badge>
								</div>
								<div className="flex items-center justify-between">
									<span className="text-sm text-muted-foreground">Period</span>
									<span className="text-sm">
										{formatDate(user.subscription.currentPeriodStart)} -{" "}
										{formatDate(user.subscription.currentPeriodEnd)}
									</span>
								</div>
							</>
						) : (
							<p className="text-sm text-muted-foreground">No subscription</p>
						)}

						{user.usage && (
							<div className="pt-2">
								<div className="mb-1 flex items-center justify-between text-xs">
									<span>
										{formatUsageDuration(user.usage.usedSeconds)} /{" "}
										{formatUsageDuration(user.usage.plan.maxSeconds)}
									</span>
									<span>{user.usage.percentUsed}%</span>
								</div>
								<Progress
									value={user.usage.percentUsed}
									className="h-2"
									style={
										{
											"--progress-foreground": usageBarColor(user.usage.percentUsed),
										} as React.CSSProperties
									}
								/>
							</div>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="text-base">Actions</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-2">
							<label htmlFor="plan-select" className="text-sm font-medium">
								Change Plan
							</label>
							<div className="flex gap-2">
								<select
									id="plan-select"
									className="flex h-9 flex-1 rounded-md border bg-background px-3 text-sm"
									value={selectedPlan}
									onChange={(e) => setSelectedPlan(e.target.value)}
								>
									{plans.map((p) => (
										<option key={p.id} value={p.id}>
											{p.name}
										</option>
									))}
								</select>
								<Button
									size="sm"
									disabled={actionLoading || selectedPlan === user.subscription?.planId}
									onClick={handleChangePlan}
								>
									Apply
								</Button>
							</div>
						</div>

						<div className="space-y-2">
							<p className="text-sm font-medium">Toggle Role</p>
							<Button
								variant="outline"
								size="sm"
								className="w-full"
								disabled={actionLoading}
								onClick={handleToggleRole}
							>
								{user.role === "admin" ? (
									<>
										<ShieldOff className="mr-2 size-4" />
										Demote to User
									</>
								) : (
									<>
										<Shield className="mr-2 size-4" />
										Promote to Admin
									</>
								)}
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Recent Sessions */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Recent Sessions</CardTitle>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Date</TableHead>
								<TableHead>Duration</TableHead>
								<TableHead>Status</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{user.recentSessions.map((s) => (
								<TableRow key={s.id}>
									<TableCell className="font-medium">{s.name ?? "Untitled"}</TableCell>
									<TableCell className="text-muted-foreground">{formatDate(s.createdAt)}</TableCell>
									<TableCell>{formatDuration(s.durationSeconds)}</TableCell>
									<TableCell>
										<Badge variant={s.status === "complete" ? "default" : "secondary"}>
											{s.status}
										</Badge>
									</TableCell>
								</TableRow>
							))}
							{user.recentSessions.length === 0 && (
								<TableRow>
									<TableCell colSpan={4} className="text-center text-muted-foreground">
										No sessions yet
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</div>
	);
}
