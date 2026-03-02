export type SubscriptionTier = "free" | "pro" | "team";

export type SessionStatus = "created" | "uploading" | "processing" | "transcribed" | "complete" | "error";

export type CEFRLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export interface User {
	id: string;
	email: string;
	firstName: string | null;
	lastName: string | null;
	avatarUrl: string | null;
	subscriptionTier: SubscriptionTier;
	createdAt: Date;
}

export interface Session {
	id: string;
	userId: string;
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
