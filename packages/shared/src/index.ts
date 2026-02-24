export type SubscriptionTier = "free" | "pro" | "team";

export type SessionStatus = "uploading" | "processing" | "complete" | "error";

export type CEFRLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export interface User {
	id: string;
	email: string;
	name: string;
	subscriptionTier: SubscriptionTier;
	createdAt: Date;
}

export interface Session {
	id: string;
	userId: string;
	durationSec: number;
	audioUrl: string;
	status: SessionStatus;
	createdAt: Date;
}

export interface TranscriptionWord {
	word: string;
	start: number;
	end: number;
	confidence: number;
}

export interface Report {
	id: string;
	sessionId: string;
	overallScore: number;
	cefrLevel: CEFRLevel;
	grammar: GrammarFeedback;
	vocabulary: VocabularyFeedback;
	fluency: FluencyFeedback;
	tips: string[];
	createdAt: Date;
}

export interface GrammarFeedback {
	score: number;
	errors: GrammarError[];
}

export interface GrammarError {
	original: string;
	correction: string;
	explanation: string;
	startTime: number;
	endTime: number;
}

export interface VocabularyFeedback {
	score: number;
	overusedWords: string[];
	suggestions: VocabSuggestion[];
}

export interface VocabSuggestion {
	original: string;
	alternative: string;
	context: string;
}

export interface FluencyFeedback {
	score: number;
	fillerCount: number;
	fillerWords: Record<string, number>;
	falseStarts: number;
	selfCorrections: number;
}
