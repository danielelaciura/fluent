/**
 * Usage tracking service — single source of truth for subscription usage.
 *
 * How usage windows work:
 * - Free (weekly/rolling): sum of usage_records where recorded_at >= now() - 7 days.
 *   The limit resets gradually — old sessions "fall off" after 7 days.
 * - Pro/Team (monthly): sum of usage_records where recorded_at is within
 *   the subscription's current_period_start..current_period_end.
 *
 * Changing limits: update the plans table directly or use PATCH /admin/plans/:id.
 * All thresholds come from the plans table at query time — never hardcoded.
 *
 * Edge case — downgrade mid-period: if a Pro user (50h/month) downgrades to
 * Free (2h/week), their existing usage_records still count. The usage service
 * will correctly report isLimitReached=true if they already exceeded 2h in
 * the past 7 days.
 */

import type { UsageInfo } from "@meetfluent/shared";
import { and, eq, gte, lt, sql, sum } from "drizzle-orm";
import { db } from "../db/index.js";
import { plans, subscriptions, usageRecords } from "../db/schema.js";

export async function getUserUsage(userId: string): Promise<UsageInfo> {
	// Get subscription + plan in one query
	const [sub] = await db
		.select({
			planId: plans.id,
			planName: plans.name,
			maxSeconds: plans.maxSecondsPerPeriod,
			periodType: plans.periodType,
			periodStart: subscriptions.currentPeriodStart,
			periodEnd: subscriptions.currentPeriodEnd,
		})
		.from(subscriptions)
		.innerJoin(plans, eq(subscriptions.planId, plans.id))
		.where(eq(subscriptions.userId, userId));

	if (!sub) {
		throw new Error(`No subscription found for user ${userId}`);
	}

	// Calculate used seconds based on period type
	let periodStart: Date;
	let periodEnd: Date;

	if (sub.periodType === "weekly") {
		// Rolling 7-day window
		periodEnd = new Date();
		periodStart = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
	} else {
		// Monthly — use subscription period dates
		periodStart = sub.periodStart;
		periodEnd = sub.periodEnd;
	}

	const [usage] = await db
		.select({
			total: sum(usageRecords.durationSeconds),
		})
		.from(usageRecords)
		.where(
			and(
				eq(usageRecords.userId, userId),
				gte(usageRecords.recordedAt, periodStart),
				lt(usageRecords.recordedAt, periodEnd),
			),
		);

	const usedSeconds = Number(usage?.total ?? 0);
	const remainingSeconds = Math.max(0, sub.maxSeconds - usedSeconds);

	return {
		plan: {
			id: sub.planId,
			name: sub.planName,
			maxSeconds: sub.maxSeconds,
			periodType: sub.periodType,
		},
		currentPeriod: {
			start: periodStart,
			end: periodEnd,
		},
		usedSeconds,
		remainingSeconds,
		isLimitReached: usedSeconds >= sub.maxSeconds,
		percentUsed: Math.min(100, Math.round((usedSeconds / sub.maxSeconds) * 100)),
	};
}

export async function recordUsage(
	userId: string,
	sessionId: string,
	durationSeconds: number,
): Promise<void> {
	await db.insert(usageRecords).values({
		userId,
		sessionId,
		durationSeconds,
	});
}

export async function canStartRecording(userId: string): Promise<{
	allowed: boolean;
	remainingSeconds: number;
	reason?: string;
}> {
	const usage = await getUserUsage(userId);

	if (usage.isLimitReached) {
		const periodLabel = usage.plan.periodType === "weekly" ? "weekly" : "monthly";
		return {
			allowed: false,
			remainingSeconds: 0,
			reason: `You've reached your ${periodLabel} limit of ${formatDuration(usage.plan.maxSeconds)}.`,
		};
	}

	return {
		allowed: true,
		remainingSeconds: usage.remainingSeconds,
	};
}

function formatDuration(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	if (minutes === 0) return `${hours}h`;
	return `${hours}h ${minutes}m`;
}
