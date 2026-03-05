import { Activity, Clock, CreditCard, Users } from "lucide-react";
import { useEffect, useState } from "react";
import LoadingSpinner from "../components/LoadingSpinner";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "../components/ui/table";
import { fetchApi } from "../lib/api";

interface Stats {
	totalUsers: number;
	totalSessions: number;
	totalRecordingHours: number;
	activeSubscriptions: number;
	subscriptionsByPlan: { planId: string; planName: string; count: number }[];
}

export default function DashboardPage() {
	const [stats, setStats] = useState<Stats | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetchApi("/admin/stats")
			.then((res) => res.json() as Promise<Stats>)
			.then(setStats)
			.finally(() => setLoading(false));
	}, []);

	if (loading) return <LoadingSpinner />;
	if (!stats) return <p className="text-muted-foreground">Failed to load stats.</p>;

	const cards = [
		{ label: "Total Users", value: stats.totalUsers, icon: Users },
		{ label: "Total Sessions", value: stats.totalSessions, icon: Activity },
		{ label: "Recording Hours", value: stats.totalRecordingHours, icon: Clock },
		{ label: "Active Subscriptions", value: stats.activeSubscriptions, icon: CreditCard },
	];

	return (
		<div className="space-y-6">
			<h1 className="font-heading text-2xl font-bold">Dashboard</h1>

			<div className="grid grid-cols-2 gap-4">
				{cards.map(({ label, value, icon: Icon }) => (
					<Card key={label}>
						<CardHeader className="flex flex-row items-center justify-between pb-2">
							<CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
							<Icon className="size-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<p className="text-2xl font-bold">{value}</p>
						</CardContent>
					</Card>
				))}
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">Subscriptions by Plan</CardTitle>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Plan</TableHead>
								<TableHead className="text-right">Subscribers</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{stats.subscriptionsByPlan.map((row) => (
								<TableRow key={row.planId}>
									<TableCell className="font-medium">{row.planName}</TableCell>
									<TableCell className="text-right">{row.count}</TableCell>
								</TableRow>
							))}
							{stats.subscriptionsByPlan.length === 0 && (
								<TableRow>
									<TableCell colSpan={2} className="text-center text-muted-foreground">
										No active subscriptions
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
