import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const SYSTEM_PROMPT = readFileSync(join(__dirname, "analysis-prompt.md"), "utf-8");

let anthropic: Anthropic | null = null;

function getClient(): Anthropic {
	if (!anthropic) {
		const apiKey = process.env.ANTHROPIC_API_KEY;
		if (!apiKey) {
			throw new Error("ANTHROPIC_API_KEY environment variable is not set");
		}
		anthropic = new Anthropic({ apiKey });
	}
	return anthropic;
}

export interface GrammarError {
	original: string;
	corrected: string;
	rule: string;
	explanation: string;
}

export interface OverusedWord {
	word: string;
	count: number;
	alternatives: string[];
}

export interface AnalysisResult {
	overall_score: number;
	cefr_level: string;
	grammar: {
		score: number;
		errors: GrammarError[];
		summary: string;
	};
	vocabulary: {
		score: number;
		range_assessment: string;
		overused_words: OverusedWord[];
		good_usage: string[];
	};
	fluency: {
		score: number;
		filler_words: Record<string, number>;
		false_starts: number;
		incomplete_sentences: number;
		summary: string;
	};
	business_english: {
		score: number;
		strengths: string[];
		improvements: string[];
	};
	tips: string[];
}

export async function analyzeTranscription(text: string): Promise<AnalysisResult> {
	const response = await getClient().messages.create({
		model: "claude-sonnet-4-20250514",
		max_tokens: 4096,
		system: SYSTEM_PROMPT,
		messages: [
			{
				role: "user",
				content: `Analyze this meeting transcription:\n\n${text}`,
			},
		],
	});

	const content = response.content[0];
	if (content.type !== "text") {
		throw new Error("Unexpected response type from Claude");
	}

	// Strip markdown code fences if Claude wraps the JSON
	let raw = content.text.trim();
	if (raw.startsWith("```")) {
		raw = raw.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?\s*```$/, "");
	}

	const result: AnalysisResult = JSON.parse(raw);
	return result;
}
