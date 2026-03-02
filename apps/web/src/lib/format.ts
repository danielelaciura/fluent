export function formatDate(date: string | Date): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(date));
}

export function formatDuration(seconds: number | null): string {
	if (!seconds) return "—";
	const m = Math.floor(seconds / 60);
	const h = Math.floor(m / 60);
	if (h > 0) return `${h}h ${m % 60}m`;
	return `${m} min`;
}

export function cefrColor(level: string): string {
	if (level === "A1" || level === "A2") return "#EF4444";
	if (level === "B1") return "#F59E0B";
	if (level === "B2") return "#10B981";
	return "#1B6B93"; // C1, C2
}

export function scoreColor(score: number): string {
	if (score < 40) return "#EF4444";
	if (score < 70) return "#F59E0B";
	return "#10B981";
}

const CEFR_LABELS: Record<string, string> = {
	A1: "Beginner",
	A2: "Elementary",
	B1: "Intermediate",
	B2: "Upper Intermediate",
	C1: "Advanced",
	C2: "Proficient",
};

export function cefrLabel(level: string): string {
	return CEFR_LABELS[level] ?? level;
}
