import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import LoadingSpinner from "../components/LoadingSpinner";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { fetchApi } from "../lib/api";
import { formatUsageDuration, usageBarColor } from "../lib/format";

interface UsageInfo {
	plan: { id: string; name: string; maxSeconds: number; periodType: string };
	currentPeriod: { start: string; end: string };
	usedSeconds: number;
	remainingSeconds: number;
	isLimitReached: boolean;
	percentUsed: number;
}

interface PlanInfo {
	id: string;
	name: string;
	maxSecondsPerPeriod: number;
	periodType: string;
	priceCents: number;
	isActive: boolean;
}

const PLAN_FEATURES: Record<string, string[]> = {
	free: [
		"2 hours of recording per week",
		"Basic transcription",
		"Grammar & vocabulary analysis",
		"CEFR level assessment",
	],
	pro: [
		"10 hours of recording per month",
		"Premium AI analysis",
		"Advanced fluency insights",
		"Business English coaching",
		"Priority processing",
	],
	team: [
		"50 hours of recording per month",
		"Everything in Pro",
		"Team analytics dashboard",
		"Admin controls",
		"Dedicated support",
	],
};

export default function SubscriptionPage() {
	const [usage, setUsage] = useState<UsageInfo | null>(null);
	const [plans, setPlans] = useState<PlanInfo[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
	const [showDowngradeConfirm, setShowDowngradeConfirm] = useState<string | null>(null);
	const [changingPlan, setChangingPlan] = useState(false);

	useEffect(() => {
		Promise.all([fetchApi("/users/me/usage"), fetchApi("/plans")])
			.then(async ([usageRes, plansRes]) => {
				if (usageRes.ok) setUsage(await usageRes.json());
				if (plansRes.ok) {
					const data = await plansRes.json();
					setPlans(data.plans ?? data);
				}
			})
			.finally(() => setIsLoading(false));
	}, []);

	async function handleChangePlan(planId: string) {
		setChangingPlan(true);
		try {
			const res = await fetchApi("/users/me/subscription/change-plan", {
				method: "POST",
				body: JSON.stringify({ planId }),
			});
			if (res.ok) {
				const usageRes = await fetchApi("/users/me/usage");
				if (usageRes.ok) setUsage(await usageRes.json());
			}
		} finally {
			setChangingPlan(false);
			setShowDowngradeConfirm(null);
		}
	}

	if (isLoading) return <LoadingSpinner />;

	const currentPlanId = usage?.plan.id ?? "free";

	const planOrder = ["free", "pro", "team"];
	const currentIndex = planOrder.indexOf(currentPlanId);

	return (
		<div>
			<h1 className="mb-6 text-2xl font-bold">Subscription</h1>

			{/* Current plan usage */}
			{usage && (
				<Card className="mb-8">
					<CardContent className="py-5">
						<div className="mb-3 flex items-center justify-between">
							<div className="flex items-center gap-2">
								<span className="text-lg font-semibold">Current Plan</span>
								<Badge
									variant="secondary"
									className={
										currentPlanId === "pro"
											? "bg-blue-100 text-blue-700"
											: currentPlanId === "team"
												? "bg-purple-100 text-purple-700"
												: "bg-gray-100 text-gray-500"
									}
								>
									{usage.plan.name}
								</Badge>
							</div>
							<span className="text-sm text-muted-foreground">
								{new Date(usage.currentPeriod.start).toLocaleDateString()} –{" "}
								{new Date(usage.currentPeriod.end).toLocaleDateString()}
							</span>
						</div>
						<div className="mb-1 flex justify-between text-sm">
							<span>
								{formatUsageDuration(usage.usedSeconds)} used of{" "}
								{formatUsageDuration(usage.plan.maxSeconds)}
							</span>
							<span className="text-muted-foreground">{Math.round(usage.percentUsed)}%</span>
						</div>
						<Progress
							value={Math.min(100, usage.percentUsed)}
							className="h-2.5"
							style={
								{
									"--progress-color": usageBarColor(usage.percentUsed),
								} as React.CSSProperties
							}
						/>
						{usage.isLimitReached && (
							<p className="mt-2 text-sm font-medium text-red-500">
								You've reached your recording limit for this period.
							</p>
						)}
					</CardContent>
				</Card>
			)}

			{/* Plan comparison */}
			<h2 className="mb-4 text-lg font-semibold">Plans</h2>
			<div className="grid gap-4 md:grid-cols-3">
				{plans
					.filter((p) => p.isActive)
					.sort((a, b) => a.priceCents - b.priceCents)
					.map((plan) => {
						const isCurrent = plan.id === currentPlanId;
						const planIndex = planOrder.indexOf(plan.id);
						const isUpgrade = planIndex > currentIndex;
						const isDowngrade = planIndex < currentIndex;
						const features = PLAN_FEATURES[plan.id] ?? [];

						return (
							<Card key={plan.id} className={isCurrent ? "border-2 border-primary" : ""}>
								<CardContent className="py-5">
									<div className="mb-4 flex items-center justify-between">
										<h3 className="text-lg font-bold">{plan.name}</h3>
										{isCurrent && (
											<Badge variant="secondary" className="bg-primary/10 text-primary">
												Current
											</Badge>
										)}
									</div>

									<div className="mb-4">
										<span className="text-3xl font-bold">
											{plan.priceCents === 0 ? "Free" : `$${(plan.priceCents / 100).toFixed(0)}`}
										</span>
										{plan.priceCents > 0 && <span className="text-muted-foreground">/month</span>}
									</div>

									<p className="mb-4 text-sm text-muted-foreground">
										{formatUsageDuration(plan.maxSecondsPerPeriod)} of recording per{" "}
										{plan.periodType === "weekly" ? "week" : "month"}
									</p>

									<ul className="mb-6 space-y-2">
										{features.map((feature) => (
											<li key={feature} className="flex items-start gap-2 text-sm">
												<Check className="mt-0.5 size-4 shrink-0 text-green-500" />
												{feature}
											</li>
										))}
									</ul>

									{isCurrent ? (
										<Button disabled className="w-full">
											Current Plan
										</Button>
									) : isUpgrade ? (
										<Button className="w-full" onClick={() => setShowUpgradeDialog(true)}>
											Upgrade
										</Button>
									) : isDowngrade ? (
										<Button
											variant="outline"
											className="w-full"
											onClick={() => setShowDowngradeConfirm(plan.id)}
										>
											Downgrade
										</Button>
									) : null}
								</CardContent>
							</Card>
						);
					})}
			</div>

			{/* Upgrade dialog (placeholder) */}
			{showUpgradeDialog && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
					<Card className="w-full max-w-md">
						<CardContent className="py-6 text-center">
							<h3 className="mb-2 text-lg font-semibold">Stripe coming soon</h3>
							<p className="mb-4 text-sm text-muted-foreground">
								Payment integration is not yet available. Check back soon!
							</p>
							<Button onClick={() => setShowUpgradeDialog(false)}>Close</Button>
						</CardContent>
					</Card>
				</div>
			)}

			{/* Downgrade confirmation dialog */}
			{showDowngradeConfirm && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
					<Card className="w-full max-w-md">
						<CardContent className="py-6">
							<h3 className="mb-2 text-lg font-semibold">Confirm Downgrade</h3>
							<p className="mb-4 text-sm text-muted-foreground">
								Are you sure you want to downgrade? You'll lose access to premium features at the
								end of your current billing period.
							</p>
							<div className="flex gap-2">
								<Button
									variant="outline"
									className="flex-1"
									onClick={() => setShowDowngradeConfirm(null)}
									disabled={changingPlan}
								>
									Cancel
								</Button>
								<Button
									variant="destructive"
									className="flex-1"
									disabled={changingPlan}
									onClick={() => handleChangePlan(showDowngradeConfirm)}
								>
									{changingPlan ? "Downgrading..." : "Confirm Downgrade"}
								</Button>
							</div>
						</CardContent>
					</Card>
				</div>
			)}
		</div>
	);
}
