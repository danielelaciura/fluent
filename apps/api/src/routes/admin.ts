import { and, count, desc, eq, ilike, or, sql, sum } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { plans, sessions, subscriptions, usageRecords, users } from "../db/schema.js";
import { getUserUsage } from "../services/usage.js";

export default async function adminRoutes(fastify: FastifyInstance) {
	const adminAuth = { onRequest: [fastify.authenticateAdmin] };

	// ─── Stats ────────────────────────────────────────────────
	fastify.get("/admin/stats", adminAuth, async () => {
		const [[userCount], [sessionCount], [hoursResult], [activeSubCount]] = await Promise.all([
			db.select({ value: count() }).from(users),
			db.select({ value: count() }).from(sessions),
			db
				.select({ value: sum(sessions.durationSeconds) })
				.from(sessions)
				.where(eq(sessions.status, "complete")),
			db.select({ value: count() }).from(subscriptions).where(eq(subscriptions.status, "active")),
		]);

		const subsByPlan = await db
			.select({
				planId: plans.id,
				planName: plans.name,
				count: count(),
			})
			.from(subscriptions)
			.innerJoin(plans, eq(subscriptions.planId, plans.id))
			.where(eq(subscriptions.status, "active"))
			.groupBy(plans.id, plans.name);

		return {
			totalUsers: userCount.value,
			totalSessions: sessionCount.value,
			totalRecordingHours: Math.round((Number(hoursResult.value ?? 0) / 3600) * 10) / 10,
			activeSubscriptions: activeSubCount.value,
			subscriptionsByPlan: subsByPlan,
		};
	});

	// ─── Users list (paginated + search) ──────────────────────
	fastify.get<{
		Querystring: { page?: string; pageSize?: string; search?: string };
	}>("/admin/users", adminAuth, async (request) => {
		const page = Math.max(1, Number(request.query.page) || 1);
		const pageSize = Math.min(100, Math.max(1, Number(request.query.pageSize) || 20));
		const search = request.query.search?.trim();
		const offset = (page - 1) * pageSize;

		const searchCondition = search
			? or(
					ilike(users.email, `%${search}%`),
					ilike(users.firstName, `%${search}%`),
					ilike(users.lastName, `%${search}%`),
				)
			: undefined;

		const [[totalResult], rows] = await Promise.all([
			db.select({ value: count() }).from(users).where(searchCondition),
			db
				.select({
					id: users.id,
					email: users.email,
					firstName: users.firstName,
					lastName: users.lastName,
					avatarUrl: users.avatarUrl,
					role: users.role,
					createdAt: users.createdAt,
					planId: plans.id,
					planName: plans.name,
					subscriptionStatus: subscriptions.status,
				})
				.from(users)
				.leftJoin(subscriptions, eq(users.id, subscriptions.userId))
				.leftJoin(plans, eq(subscriptions.planId, plans.id))
				.where(searchCondition)
				.orderBy(desc(users.createdAt))
				.limit(pageSize)
				.offset(offset),
		]);

		const totalCount = totalResult.value;

		return {
			data: rows,
			page,
			pageSize,
			totalCount,
			totalPages: Math.ceil(totalCount / pageSize),
		};
	});

	// ─── User detail ──────────────────────────────────────────
	fastify.get<{ Params: { id: string } }>("/admin/users/:id", adminAuth, async (request, reply) => {
		const { id } = request.params;

		const [user] = await db
			.select({
				id: users.id,
				email: users.email,
				firstName: users.firstName,
				lastName: users.lastName,
				avatarUrl: users.avatarUrl,
				role: users.role,
				createdAt: users.createdAt,
			})
			.from(users)
			.where(eq(users.id, id));

		if (!user) {
			reply.code(404).send({ error: "User not found" });
			return;
		}

		// Subscription
		const [sub] = await db
			.select({
				id: subscriptions.id,
				planId: plans.id,
				planName: plans.name,
				status: subscriptions.status,
				currentPeriodStart: subscriptions.currentPeriodStart,
				currentPeriodEnd: subscriptions.currentPeriodEnd,
			})
			.from(subscriptions)
			.innerJoin(plans, eq(subscriptions.planId, plans.id))
			.where(eq(subscriptions.userId, id));

		// Usage
		let usage = null;
		try {
			usage = await getUserUsage(id);
		} catch {
			// No subscription = no usage
		}

		// Recent sessions
		const recentSessions = await db
			.select({
				id: sessions.id,
				userId: sessions.userId,
				name: sessions.name,
				durationSeconds: sessions.durationSeconds,
				audioUrl: sessions.audioUrl,
				status: sessions.status,
				errorMessage: sessions.errorMessage,
				createdAt: sessions.createdAt,
			})
			.from(sessions)
			.where(eq(sessions.userId, id))
			.orderBy(desc(sessions.createdAt))
			.limit(10);

		return {
			...user,
			subscription: sub ?? null,
			usage,
			recentSessions,
		};
	});

	// ─── Update user role ─────────────────────────────────────
	fastify.patch<{ Params: { id: string }; Body: { role: "user" | "admin" } }>(
		"/admin/users/:id",
		adminAuth,
		async (request, reply) => {
			const { id } = request.params;
			const { role } = request.body;

			if (!role || !["user", "admin"].includes(role)) {
				reply.code(400).send({ error: "Invalid role. Must be 'user' or 'admin'" });
				return;
			}

			// Prevent self-demotion
			if (id === request.user.userId && role !== "admin") {
				reply.code(400).send({ error: "Cannot demote yourself" });
				return;
			}

			const [updated] = await db
				.update(users)
				.set({ role, updatedAt: new Date() })
				.where(eq(users.id, id))
				.returning({ id: users.id, role: users.role });

			if (!updated) {
				reply.code(404).send({ error: "User not found" });
				return;
			}

			return updated;
		},
	);

	// ─── Change user subscription ─────────────────────────────
	fastify.post<{ Params: { id: string }; Body: { planId: string } }>(
		"/admin/users/:id/subscription",
		adminAuth,
		async (request, reply) => {
			const { id } = request.params;
			const { planId } = request.body;

			if (!planId) {
				reply.code(400).send({ error: "planId is required" });
				return;
			}

			const [plan] = await db.select().from(plans).where(eq(plans.id, planId));
			if (!plan) {
				reply.code(400).send({ error: "Plan not found" });
				return;
			}

			// Verify user exists
			const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, id));
			if (!user) {
				reply.code(404).send({ error: "User not found" });
				return;
			}

			const now = new Date();
			const periodEnd =
				plan.periodType === "weekly"
					? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
					: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

			const [updated] = await db
				.update(subscriptions)
				.set({
					planId,
					currentPeriodStart: now,
					currentPeriodEnd: periodEnd,
					updatedAt: now,
				})
				.where(eq(subscriptions.userId, id))
				.returning();

			if (!updated) {
				reply.code(404).send({ error: "No subscription found for this user" });
				return;
			}

			return updated;
		},
	);

	// ─── Update plan (migrated from API-key auth) ─────────────
	fastify.patch<{
		Params: { id: string };
		Body: { maxSecondsPerPeriod?: number; isActive?: boolean };
	}>("/admin/plans/:id", adminAuth, async (request, reply) => {
		const { id } = request.params;
		const { maxSecondsPerPeriod, isActive } = request.body;

		if (maxSecondsPerPeriod === undefined && isActive === undefined) {
			reply.code(400).send({ error: "Nothing to update" });
			return;
		}

		const [updated] = await db
			.update(plans)
			.set({
				...(maxSecondsPerPeriod !== undefined ? { maxSecondsPerPeriod } : {}),
				...(isActive !== undefined ? { isActive } : {}),
			})
			.where(eq(plans.id, id))
			.returning();

		if (!updated) {
			reply.code(404).send({ error: "Plan not found" });
			return;
		}

		return updated;
	});
}
