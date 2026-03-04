import {
	boolean,
	date,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

export const sessionStatusEnum = pgEnum("session_status", [
	"created",
	"uploading",
	"processing",
	"transcribed",
	"complete",
	"error",
]);

export const cefrLevelEnum = pgEnum("cefr_level", ["A1", "A2", "B1", "B2", "C1", "C2"]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
	"active",
	"canceled",
	"past_due",
]);

export const periodTypeEnum = pgEnum("period_type", ["weekly", "monthly"]);

// ─── Users ───────────────────────────────────────────────
export const users = pgTable("users", {
	id: uuid("id").primaryKey().defaultRandom(),
	email: varchar("email", { length: 255 }).notNull().unique(),
	firstName: varchar("first_name", { length: 255 }),
	lastName: varchar("last_name", { length: 255 }),
	avatarUrl: varchar("avatar_url", { length: 1024 }),
	googleId: varchar("google_id", { length: 255 }).notNull().unique(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }),
});

// ─── Plans ──────────────────────────────────────────────
export const plans = pgTable("plans", {
	id: varchar("id", { length: 50 }).primaryKey(),
	name: varchar("name", { length: 100 }).notNull(),
	maxSecondsPerPeriod: integer("max_seconds_per_period").notNull(),
	periodType: periodTypeEnum("period_type").notNull(),
	analysisProvider: varchar("analysis_provider", { length: 50 }).notNull(),
	sttProvider: varchar("stt_provider", { length: 50 }).notNull(),
	priceCents: integer("price_cents").notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Subscriptions ──────────────────────────────────────
export const subscriptions = pgTable("subscriptions", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id")
		.notNull()
		.unique()
		.references(() => users.id),
	planId: varchar("plan_id", { length: 50 })
		.notNull()
		.references(() => plans.id),
	status: subscriptionStatusEnum("status").default("active").notNull(),
	stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
	stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
	currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull(),
	currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }),
});

// ─── Sessions ────────────────────────────────────────────
export const sessions = pgTable("sessions", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id")
		.notNull()
		.references(() => users.id),
	name: varchar("name", { length: 255 }),
	durationSeconds: integer("duration_seconds"),
	audioUrl: varchar("audio_url", { length: 1024 }),
	totalChunks: integer("total_chunks"),
	status: sessionStatusEnum("status").default("created").notNull(),
	errorMessage: varchar("error_message", { length: 1024 }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }),
});

// ─── Usage Records ──────────────────────────────────────
export const usageRecords = pgTable("usage_records", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id")
		.notNull()
		.references(() => users.id),
	sessionId: uuid("session_id")
		.notNull()
		.references(() => sessions.id),
	durationSeconds: integer("duration_seconds").notNull(),
	recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Transcriptions ──────────────────────────────────────
export const transcriptions = pgTable("transcriptions", {
	id: uuid("id").primaryKey().defaultRandom(),
	sessionId: uuid("session_id")
		.notNull()
		.unique()
		.references(() => sessions.id),
	fullText: text("full_text").notNull(),
	wordsJson: jsonb("words_json").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Reports ─────────────────────────────────────────────
export const reports = pgTable("reports", {
	id: uuid("id").primaryKey().defaultRandom(),
	sessionId: uuid("session_id")
		.notNull()
		.unique()
		.references(() => sessions.id),
	overallScore: integer("overall_score").notNull(),
	cefrLevel: cefrLevelEnum("cefr_level").notNull(),
	grammarJson: jsonb("grammar_json").notNull(),
	vocabularyJson: jsonb("vocabulary_json").notNull(),
	fluencyJson: jsonb("fluency_json").notNull(),
	businessEnglishJson: jsonb("business_english_json").notNull(),
	tips: jsonb("tips").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── User Progress ───────────────────────────────────────
export const userProgress = pgTable("user_progress", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id")
		.notNull()
		.references(() => users.id),
	sessionId: uuid("session_id")
		.notNull()
		.references(() => sessions.id),
	date: date("date").notNull(),
	overallScore: integer("overall_score").notNull(),
	grammarScore: integer("grammar_score").notNull(),
	vocabularyScore: integer("vocabulary_score").notNull(),
	fluencyScore: integer("fluency_score").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
