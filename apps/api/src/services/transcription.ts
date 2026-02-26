import OpenAI, { toFile } from "openai";

let openai: OpenAI | null = null;

function getClient(): OpenAI {
	if (!openai) {
		const apiKey = process.env.OPENAI_API_KEY;
		if (!apiKey) {
			throw new Error("OPENAI_API_KEY environment variable is not set");
		}
		openai = new OpenAI({ apiKey });
	}
	return openai;
}

export interface TranscriptionWord {
	word: string;
	start: number;
	end: number;
}

export interface TranscriptionResult {
	text: string;
	words: TranscriptionWord[];
}

export async function transcribeAudio(audioBuffer: Buffer): Promise<TranscriptionResult> {
	const file = await toFile(audioBuffer, "audio.webm", { type: "audio/webm" });

	const response = await getClient().audio.transcriptions.create({
		model: "whisper-1",
		file,
		response_format: "verbose_json",
		timestamp_granularities: ["word"],
	});

	const words: TranscriptionWord[] = (response.words ?? []).map((w) => ({
		word: w.word,
		start: w.start,
		end: w.end,
	}));

	return {
		text: response.text,
		words,
	};
}
