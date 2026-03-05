import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { plans, subscriptions } from "../db/schema.js";
import { canStartRecording, getUserUsage } from "../services/usage.js";

export default async function subscriptionRoutes(fastify: FastifyInstance) {
	// ─── Public ──────────────────────────────────────────────

	fastify.get("/plans", async () => {
		const rows = await db
			.select({
				id: plans.id,
				name: plans.name,
				maxSeconds: plans.maxSecondsPerPeriod,
				periodType: plans.periodType,
				priceCents: plans.priceCents,
			})
			.from(plans)
			.where(eq(plans.isActive, true));

		return { plans: rows };
	});

	// ─── Authenticated ──────────────────────────────────────

	fastify.get("/users/me/usage", { onRequest: [fastify.authenticate] }, async (request) => {
		return getUserUsage(request.user.userId);
	});

	fastify.get("/users/me/subscription", { onRequest: [fastify.authenticate] }, async (request) => {
		const [sub] = await db
			.select({
				id: subscriptions.id,
				planId: plans.id,
				planName: plans.name,
				maxSeconds: plans.maxSecondsPerPeriod,
				periodType: plans.periodType,
				priceCents: plans.priceCents,
				status: subscriptions.status,
				stripeSubscriptionId: subscriptions.stripeSubscriptionId,
				stripeCustomerId: subscriptions.stripeCustomerId,
				currentPeriodStart: subscriptions.currentPeriodStart,
				currentPeriodEnd: subscriptions.currentPeriodEnd,
			})
			.from(subscriptions)
			.innerJoin(plans, eq(subscriptions.planId, plans.id))
			.where(eq(subscriptions.userId, request.user.userId));

		if (!sub) {
			throw { statusCode: 404, message: "No subscription found" };
		}

		return {
			id: sub.id,
			plan: {
				id: sub.planId,
				name: sub.planName,
				maxSeconds: sub.maxSeconds,
				periodType: sub.periodType,
				priceCents: sub.priceCents,
			},
			status: sub.status,
			stripeSubscriptionId: sub.stripeSubscriptionId,
			currentPeriodStart: sub.currentPeriodStart,
			currentPeriodEnd: sub.currentPeriodEnd,
		};
	});

	fastify.get("/users/me/can-record", { onRequest: [fastify.authenticate] }, async (request) => {
		return canStartRecording(request.user.userId);
	});

	fastify.post<{ Body: { planId: string } }>(
		"/users/me/subscription/change-plan",
		{ onRequest: [fastify.authenticate] },
		async (request, reply) => {
			const { planId } = request.body;

			if (!planId) {
				reply.code(400).send({ error: "planId is required" });
				return;
			}

			// Validate plan exists and is active
			const [plan] = await db.select().from(plans).where(eq(plans.id, planId));

			if (!plan || !plan.isActive) {
				reply.code(400).send({ error: "Invalid or inactive plan" });
				return;
			}

			// TODO: When Stripe is integrated, gate paid plan upgrades behind payment here.
			// For now, any user can switch to any plan without payment.

			const now = new Date();
			let periodEnd: Date;
			if (plan.periodType === "weekly") {
				periodEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
			} else {
				periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
			}

			const [updated] = await db
				.update(subscriptions)
				.set({
					planId,
					currentPeriodStart: now,
					currentPeriodEnd: periodEnd,
					stripeSubscriptionId: plan.priceCents === 0 ? null : subscriptions.stripeSubscriptionId,
					updatedAt: now,
				})
				.where(eq(subscriptions.userId, request.user.userId))
				.returning();

			if (!updated) {
				reply.code(404).send({ error: "No subscription found" });
				return;
			}

			return {
				id: updated.id,
				planId: updated.planId,
				status: updated.status,
				currentPeriodStart: updated.currentPeriodStart,
				currentPeriodEnd: updated.currentPeriodEnd,
			};
		},
	);
}
