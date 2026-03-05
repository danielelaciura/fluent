export function formatDate(date: string | Date): string {
	return new Date(date).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export function formatDuration(seconds: number | null): string {
	if (!seconds) return "-";
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	if (h > 0) return `${h}h ${m}m`;
	return `${m} min`;
}

export function formatUsageDuration(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	if (h > 0) return `${h}h ${m}m`;
	return `${m}m`;
}

export function usageBarColor(percent: number): string {
	if (percent >= 90) return "#ef4444";
	if (percent >= 70) return "#f59e0b";
	return "#22c55e";
}
