export type PlanId = "free" | "pro" | "team";

export type PeriodType = "weekly" | "monthly";

export type SubscriptionStatus = "active" | "canceled" | "past_due";

export type SessionStatus =
	| "created"
	| "uploading"
	| "processing"
	| "transcribed"
	| "complete"
	| "error";

export type CEFRLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export interface User {
	id: string;
	email: string;
	firstName: string | null;
	lastName: string | null;
	avatarUrl: string | null;
	createdAt: Date;
}

export interface Plan {
	id: string;
	name: string;
	maxSecondsPerPeriod: number;
	periodType: PeriodType;
	priceCents: number;
	isActive: boolean;
}

export interface Subscription {
	id: string;
	userId: string;
	plan: Plan;
	status: SubscriptionStatus;
	stripeSubscriptionId: string | null;
	stripeCustomerId: string | null;
	currentPeriodStart: Date;
	currentPeriodEnd: Date;
}

export interface UsageInfo {
	plan: {
		id: string;
		name: string;
		maxSeconds: number;
		periodType: PeriodType;
	};
	currentPeriod: {
		start: Date;
		end: Date;
	};
	usedSeconds: number;
	remainingSeconds: number;
	isLimitReached: boolean;
	percentUsed: number;
}

export interface Session {
	id: string;
	userId: string;
	name: string | null;
	durationSeconds: number | null;
	audioUrl: string | null;
	status: SessionStatus;
	errorMessage: string | null;
	createdAt: Date;
}

export interface TranscriptionWord {
	word: string;
	start: number;
	end: number;
}

export interface Report {
	id: string;
	sessionId: string;
	overallScore: number;
	cefrLevel: CEFRLevel;
	grammar: GrammarFeedback;
	vocabulary: VocabularyFeedback;
	fluency: FluencyFeedback;
	businessEnglish: BusinessEnglishFeedback;
	tips: string[];
	createdAt: Date;
}

export interface GrammarFeedback {
	score: number;
	errors: GrammarError[];
	summary: string;
}

export interface GrammarError {
	original: string;
	corrected: string;
	rule: string;
	explanation: string;
}

export interface VocabularyFeedback {
	score: number;
	range_assessment: string;
	overused_words: OverusedWord[];
	good_usage: string[];
}

export interface OverusedWord {
	word: string;
	count: number;
	alternatives: string[];
}

export interface FluencyFeedback {
	score: number;
	filler_words: Record<string, number>;
	false_starts: number;
	incomplete_sentences: number;
	summary: string;
}

export interface BusinessEnglishFeedback {
	score: number;
	strengths: string[];
	improvements: string[];
}
