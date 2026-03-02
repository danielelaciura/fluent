import {
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

export const subscriptionTierEnum = pgEnum("subscription_tier", ["free", "pro", "team"]);

export const sessionStatusEnum = pgEnum("session_status", [
	"created",
	"uploading",
	"processing",
	"transcribed",
	"complete",
	"error",
]);

export const cefrLevelEnum = pgEnum("cefr_level", ["A1", "A2", "B1", "B2", "C1", "C2"]);

// ─── Users ───────────────────────────────────────────────
export const users = pgTable("users", {
	id: uuid("id").primaryKey().defaultRandom(),
	email: varchar("email", { length: 255 }).notNull().unique(),
	firstName: varchar("first_name", { length: 255 }),
	lastName: varchar("last_name", { length: 255 }),
	avatarUrl: varchar("avatar_url", { length: 1024 }),
	googleId: varchar("google_id", { length: 255 }).notNull().unique(),
	subscriptionTier: subscriptionTierEnum("subscription_tier").default("free").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }),
});

// ─── Sessions ────────────────────────────────────────────
export const sessions = pgTable("sessions", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id")
		.notNull()
		.references(() => users.id),
	durationSeconds: integer("duration_seconds"),
	audioUrl: varchar("audio_url", { length: 1024 }),
	status: sessionStatusEnum("status").default("created").notNull(),
	errorMessage: varchar("error_message", { length: 1024 }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }),
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
