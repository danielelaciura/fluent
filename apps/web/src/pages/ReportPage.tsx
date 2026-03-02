import { Loader2, Printer } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { Skeleton } from "../components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { fetchApi } from "../lib/api";
import { cefrColor, cefrLabel, formatDate, formatDuration, scoreColor } from "../lib/format";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GrammarError {
	original: string;
	corrected: string;
	rule: string;
	explanation: string;
}

interface GrammarFeedback {
	score: number;
	errors: GrammarError[];
	summary: string;
}

interface OverusedWord {
	word: string;
	count: number;
	alternatives: string[];
}

interface VocabularyFeedback {
	score: number;
	range_assessment: string;
	overused_words: OverusedWord[];
	good_usage: string[];
}

interface FluencyFeedback {
	score: number;
	filler_words: Record<string, number>;
	false_starts: number;
	incomplete_sentences: number;
	summary: string;
}

interface BusinessEnglishFeedback {
	score: number;
	strengths: string[];
	improvements: string[];
}

interface Report {
	overallScore: number;
	cefrLevel: string;
	grammar: GrammarFeedback;
	vocabulary: VocabularyFeedback;
	fluency: FluencyFeedback;
	businessEnglish: BusinessEnglishFeedback;
	tips: string[];
	createdAt: string;
}

interface Session {
	status: string;
	durationSeconds: number | null;
	errorMessage: string | null;
	createdAt: string;
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function SummaryBox({ text }: { text: string }) {
	return (
		<div className="rounded-lg bg-muted p-4 text-sm leading-relaxed">{text}</div>
	);
}

function ScoreCircle({ score, size = "lg" }: { score: number; size?: "sm" | "lg" }) {
	const isSmall = size === "sm";
	const r = isSmall ? 18 : 38;
	const strokeWidth = isSmall ? 4 : 8;
	const svgSize = isSmall ? 44 : 96;
	const circ = 2 * Math.PI * r;
	const arc = (score / 100) * circ;
	const color = scoreColor(score);
	return (
		<div
			className="relative flex items-center justify-center"
			style={{ width: svgSize, height: svgSize }}
		>
			<svg
				width={svgSize}
				height={svgSize}
				className="absolute inset-0 -rotate-90"
				aria-hidden="true"
			>
				<circle
					cx={svgSize / 2}
					cy={svgSize / 2}
					r={r}
					fill="none"
					stroke="hsl(var(--border))"
					strokeWidth={strokeWidth}
				/>
				<circle
					cx={svgSize / 2}
					cy={svgSize / 2}
					r={r}
					fill="none"
					stroke={color}
					strokeWidth={strokeWidth}
					strokeDasharray={`${arc} ${circ - arc}`}
					strokeLinecap="round"
				/>
			</svg>
			<div className="relative text-center">
				<p
					className={`font-bold leading-none ${isSmall ? "text-xs" : "text-2xl"}`}
					style={{ color }}
				>
					{score}
				</p>
				{!isSmall && <p className="text-xs text-muted-foreground">/100</p>}
			</div>
		</div>
	);
}

function HighlightsStrip({
	report,
	onSelectTab,
}: {
	report: Report;
	onSelectTab: (tab: TabId) => void;
}) {
	const fillerTotal = Object.values(report.fluency.filler_words).reduce((a, b) => a + b, 0);
	const topFiller = Object.entries(report.fluency.filler_words).sort(([, a], [, b]) => b - a)[0];

	const cards: { tab: TabId; emoji: string; title: string; line1: string; line2: string; score: number }[] = [
		{
			tab: "grammar",
			emoji: "📝",
			title: "Grammar",
			line1:
				report.grammar.errors.length === 0
					? "No errors detected"
					: `${report.grammar.errors.length} error${report.grammar.errors.length !== 1 ? "s" : ""} found`,
			line2:
				report.grammar.errors.length > 0
					? `Most common: ${report.grammar.errors[0].rule}`
					: "Great job!",
			score: report.grammar.score,
		},
		{
			tab: "vocabulary",
			emoji: "📚",
			title: "Vocabulary",
			line1:
				report.vocabulary.overused_words.length === 0
					? "Excellent range"
					: `"${report.vocabulary.overused_words[0].word}" overused (${report.vocabulary.overused_words[0].count}×)`,
			line2: report.vocabulary.overused_words.length > 0
				? `${report.vocabulary.overused_words.length} word${report.vocabulary.overused_words.length !== 1 ? "s" : ""} to improve`
				: "Good variety",
			score: report.vocabulary.score,
		},
		{
			tab: "fluency",
			emoji: "🎙️",
			title: "Fluency",
			line1:
				fillerTotal === 0
					? "No filler words"
					: `${fillerTotal} filler word${fillerTotal !== 1 ? "s" : ""}`,
			line2: topFiller ? `"${topFiller[0]}" (${topFiller[1]}×)` : "Clean speech",
			score: report.fluency.score,
		},
		{
			tab: "business",
			emoji: "💼",
			title: "Business",
			line1: `${report.businessEnglish.strengths.length} strength${report.businessEnglish.strengths.length !== 1 ? "s" : ""} · ${report.businessEnglish.improvements.length} to improve`,
			line2:
				report.businessEnglish.strengths.length > 0
					? report.businessEnglish.strengths[0]
					: report.businessEnglish.improvements.length > 0
						? report.businessEnglish.improvements[0]
						: "",
			score: report.businessEnglish.score,
		},
	];

	return (
		<div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
			{cards.map((c) => (
				<button
					key={c.tab}
					type="button"
					onClick={() => onSelectTab(c.tab)}
					className="cursor-pointer text-left"
				>
					<Card className="transition-colors hover:border-primary/30">
						<CardContent className="flex items-start gap-3 p-4">
							<span className="text-lg">{c.emoji}</span>
							<div className="min-w-0 flex-1">
								<div className="mb-1 flex items-center gap-2">
									<p className="text-sm font-semibold">{c.title}</p>
									<span
										className="inline-block size-2 rounded-full"
										style={{ backgroundColor: scoreColor(c.score) }}
									/>
								</div>
								<p className="text-sm text-foreground">{c.line1}</p>
								<p className="truncate text-xs text-muted-foreground">{c.line2}</p>
							</div>
						</CardContent>
					</Card>
				</button>
			))}
		</div>
	);
}

// ── Section components ────────────────────────────────────────────────────────

function GrammarSection({ grammar }: { grammar: GrammarFeedback }) {
	return (
		<div>
			<SummaryBox text={grammar.summary} />

			<Separator className="my-4" />

			{grammar.errors.length === 0 ? (
				<p className="py-6 text-center font-medium text-green-600">
					No grammar errors detected. Great job! 🎉
				</p>
			) : (
				<>
					<div className="mb-3">
						<Badge variant="secondary">
							{grammar.errors.length} error{grammar.errors.length !== 1 ? "s" : ""}
						</Badge>
					</div>
					<div className="space-y-3">
						{grammar.errors.map((err, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: static list from API
							<Card key={i}>
								<CardContent className="space-y-2 p-5">
									<Badge variant="secondary" className="bg-blue-50 text-blue-700">
										{err.rule}
									</Badge>
									<p className="text-sm text-destructive line-through">{err.original}</p>
									<p className="text-sm font-medium text-green-600">{err.corrected}</p>
									<p className="text-xs leading-relaxed text-muted-foreground">
										{err.explanation}
									</p>
								</CardContent>
							</Card>
						))}
					</div>
				</>
			)}
		</div>
	);
}

function VocabularySection({ vocabulary }: { vocabulary: VocabularyFeedback }) {
	return (
		<div className="space-y-5">
			<SummaryBox text={vocabulary.range_assessment} />

			{vocabulary.overused_words.length === 0 ? (
				<p className="py-4 text-center font-medium text-green-600">
					Your vocabulary range is excellent! 🌟
				</p>
			) : (
				<div>
					<h3 className="mb-3 text-sm font-semibold">Words to Improve</h3>
					<div className="space-y-3">
						{vocabulary.overused_words.map((w, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: static list from API
							<Card key={i}>
								<CardContent>
									<p className="mb-1 text-sm font-semibold">
										&ldquo;{w.word}&rdquo;
										<span className="ml-2 text-xs font-normal text-muted-foreground">
											used {w.count} times
										</span>
									</p>
									<p className="mb-2 text-xs text-muted-foreground">Try instead:</p>
									<div className="flex flex-wrap gap-1.5">
										{w.alternatives.map((alt) => (
											<Badge key={alt} variant="secondary" className="bg-primary/10 text-primary">
												{alt}
											</Badge>
										))}
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				</div>
			)}

			{vocabulary.good_usage.length > 0 && (
				<div>
					<h3 className="mb-3 text-sm font-semibold">Good Usage</h3>
					<div className="space-y-2 rounded-lg border border-green-100 bg-green-50 p-4">
						{vocabulary.good_usage.map((phrase, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: static list from API
							<div key={i} className="flex items-start gap-2 text-sm text-green-800">
								<span className="mt-0.5 text-green-500">✓</span>
								<span>&ldquo;{phrase}&rdquo;</span>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

function FluencySection({ fluency }: { fluency: FluencyFeedback }) {
	const fillers = Object.entries(fluency.filler_words).sort(([, a], [, b]) => b - a);
	const maxCount = fillers[0]?.[1] ?? 1;

	return (
		<div className="space-y-5">
			<SummaryBox text={fluency.summary} />

			{fillers.length > 0 && (
				<div>
					<h3 className="mb-3 text-sm font-semibold">Filler Words</h3>
					<Card>
						<CardContent className="space-y-3">
							{fillers.map(([word, count]) => (
								<div key={word} className="flex items-center gap-3">
									<span className="w-20 shrink-0 text-sm font-medium">
										&ldquo;{word}&rdquo;
									</span>
									<div className="h-2 flex-1 rounded-full bg-muted">
										<div
											className="h-2 rounded-full transition-all"
											style={{
												width: `${(count / maxCount) * 100}%`,
												backgroundColor: "#F59E0B",
											}}
										/>
									</div>
									<span className="w-6 shrink-0 text-right text-sm text-muted-foreground">
										{count}
									</span>
								</div>
							))}
						</CardContent>
					</Card>
					<p className="mt-2 text-xs text-muted-foreground">
						Filler words are natural in speech. Focus on reducing the most frequent ones.
					</p>
				</div>
			)}

			<div>
				<h3 className="mb-3 text-sm font-semibold">Speech Patterns</h3>
				<div className="grid grid-cols-2 gap-3">
					<Card>
						<CardContent className="p-4 text-center">
							<p className="mb-1 text-2xl">🔄</p>
							<p className="text-2xl font-bold">{fluency.false_starts}</p>
							<p className="mt-1 text-xs text-muted-foreground">False Starts</p>
						</CardContent>
					</Card>
					<Card>
						<CardContent className="p-4 text-center">
							<p className="mb-1 text-2xl">✂️</p>
							<p className="text-2xl font-bold">{fluency.incomplete_sentences}</p>
							<p className="mt-1 text-xs text-muted-foreground">Incomplete Sentences</p>
						</CardContent>
					</Card>
				</div>
				<p className="mt-2 text-xs text-muted-foreground">
					False starts are when you begin a sentence and restart. A few are normal — they show
					you&apos;re self-correcting.
				</p>
			</div>
		</div>
	);
}

function BusinessSection({ businessEnglish }: { businessEnglish: BusinessEnglishFeedback }) {
	const hasStrengths = businessEnglish.strengths.length > 0;
	const hasImprovements = businessEnglish.improvements.length > 0;
	return (
		<div className={`grid gap-4 ${hasStrengths && hasImprovements ? "sm:grid-cols-2" : ""}`}>
			{hasStrengths && (
				<div className="rounded-lg border border-green-100 bg-green-50 p-4">
					<h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-green-800">
						<span>⭐</span> Strengths
					</h3>
					<ul className="space-y-2">
						{businessEnglish.strengths.map((s, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: static list from API
							<li key={i} className="flex items-start gap-2 text-sm text-green-800">
								<span className="mt-0.5 text-green-500">✓</span>
								<span>{s}</span>
							</li>
						))}
					</ul>
				</div>
			)}
			{hasImprovements && (
				<div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
					<h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-amber-800">
						<span>🎯</span> Areas to Improve
					</h3>
					<ul className="space-y-2">
						{businessEnglish.improvements.map((s, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: static list from API
							<li key={i} className="flex items-start gap-2 text-sm text-amber-800">
								<span className="mt-0.5">→</span>
								<span>{s}</span>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}

function TipsSection({ tips }: { tips: string[] }) {
	return (
		<div>
			<div className="space-y-3">
				{tips.map((tip, i) => (
					<Card key={tip} className="border-l-4 border-l-primary">
						<CardContent className="flex gap-4">
							<span className="mt-0.5 text-2xl font-bold leading-none text-primary">
								{i + 1}
							</span>
							<p className="text-sm leading-relaxed">{tip}</p>
						</CardContent>
					</Card>
				))}
			</div>
			<p className="mt-6 text-center text-sm italic text-muted-foreground">
				Small consistent improvements lead to big results. Focus on one tip at a time.
			</p>
		</div>
	);
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function ReportSkeleton() {
	return (
		<div className="space-y-6">
			<Skeleton className="h-4 w-48" />
			<Card>
				<CardContent>
					<div className="flex flex-wrap items-center gap-6">
						<Skeleton className="h-6 w-32" />
						<Skeleton className="h-10 w-16" />
						<Skeleton className="h-24 w-24 rounded-full" />
					</div>
					<div className="mt-4 flex gap-3">
						{[1, 2, 3, 4].map((n) => (
							<Skeleton key={n} className="h-20 flex-1" />
						))}
					</div>
				</CardContent>
			</Card>
			<div className="space-y-3">
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-32 w-full" />
				<Skeleton className="h-24 w-full" />
			</div>
		</div>
	);
}

// ── Main page ─────────────────────────────────────────────────────────────────

const TAB_ITEMS = [
	{ id: "grammar", label: "Grammar" },
	{ id: "vocabulary", label: "Vocabulary" },
	{ id: "fluency", label: "Fluency" },
	{ id: "business", label: "Business English" },
	{ id: "tips", label: "Tips" },
] as const;

type TabId = (typeof TAB_ITEMS)[number]["id"];

export default function ReportPage() {
	const { id } = useParams<{ id: string }>();
	const [session, setSession] = useState<Session | null>(null);
	const [report, setReport] = useState<Report | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [activeTab, setActiveTab] = useState<TabId>("grammar");
	const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const fetchData = useCallback(async () => {
		if (!id) return;
		const [sessionRes, reportRes] = await Promise.all([
			fetchApi(`/sessions/${id}`),
			fetchApi(`/sessions/${id}/report`),
		]);
		if (sessionRes.ok) setSession((await sessionRes.json()) as Session);
		// 202 means "not ready yet" — only set report on a real 200
		if (reportRes.status === 200) setReport((await reportRes.json()) as Report);
	}, [id]);

	useEffect(() => {
		fetchData().finally(() => setIsLoading(false));
	}, [fetchData]);

	// Poll every 5s while still processing
	useEffect(() => {
		const isProcessing = session && !["complete", "error"].includes(session.status);
		if (isProcessing && !pollingRef.current) {
			pollingRef.current = setInterval(fetchData, 5_000);
		} else if (!isProcessing && pollingRef.current) {
			clearInterval(pollingRef.current);
			pollingRef.current = null;
		}
		return () => {
			if (pollingRef.current) {
				clearInterval(pollingRef.current);
				pollingRef.current = null;
			}
		};
	}, [session, fetchData]);

	if (isLoading) return <ReportSkeleton />;

	const sessionDate = session?.createdAt ? formatDate(session.createdAt) : "—";

	// Processing / error state
	if (!report) {
		const isError = session?.status === "error";
		return (
			<div>
				<p className="mb-6 text-sm text-muted-foreground">
					<Link to="/" className="hover:underline">
						Sessions
					</Link>
					{" › "}
					{sessionDate}
				</p>
				<Card>
					<CardContent className="py-10 text-center">
						{isError ? (
							<>
								<p className="mb-3 text-4xl">⚠️</p>
								<p className="text-lg font-medium">Processing failed</p>
								<p className="mt-2 text-sm text-muted-foreground">
									{session?.errorMessage ?? "An error occurred while processing this session."}
								</p>
							</>
						) : (
							<>
								<div className="mb-4 flex justify-center">
									<Loader2 className="size-10 animate-spin text-primary" />
								</div>
								<p className="text-lg font-medium">Processing your session…</p>
								<p className="mt-2 text-sm text-muted-foreground">
									This usually takes 1–2 minutes. We&apos;ll update automatically.
								</p>
							</>
						)}
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div>
			{/* Header card */}
			<Card className="mb-6">
				<CardContent>
					{/* Top bar: breadcrumb + export */}
					<div className="no-print mb-5 flex items-center justify-between">
						<p className="text-sm text-muted-foreground">
							<Link to="/" className="hover:underline">
								Sessions
							</Link>
							{" › "}
							{sessionDate} · {formatDuration(session?.durationSeconds ?? null)}
						</p>
						<Button variant="outline" size="sm" onClick={() => window.print()}>
							<Printer className="mr-1.5 size-4" />
							Export
						</Button>
					</div>

					<Separator className="mb-5" />

					{/* Hero score + category rings */}
					<div className="flex flex-wrap items-center gap-8">
						{/* Hero: overall score + CEFR */}
						<div className="flex items-center gap-4">
							<ScoreCircle score={report.overallScore} />
							<div>
								<p
									className="text-3xl font-bold"
									style={{ color: cefrColor(report.cefrLevel) }}
								>
									{report.cefrLevel}
								</p>
								<p className="text-sm text-muted-foreground">
									{cefrLabel(report.cefrLevel)}
								</p>
							</div>
						</div>

						<Separator orientation="vertical" className="hidden h-16 sm:block" />

						{/* Category rings */}
						<div className="flex flex-1 items-center justify-around gap-2">
							{[
								{ label: "Grammar", score: report.grammar.score },
								{ label: "Vocabulary", score: report.vocabulary.score },
								{ label: "Fluency", score: report.fluency.score },
								{ label: "Business", score: report.businessEnglish.score },
							].map((cat) => (
								<div key={cat.label} className="flex flex-col items-center gap-1">
									<ScoreCircle score={cat.score} size="sm" />
									<p className="text-xs text-muted-foreground">{cat.label}</p>
								</div>
							))}
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Highlights strip */}
			<HighlightsStrip report={report} onSelectTab={setActiveTab} />

			{/* Tabs */}
			<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)}>
				<div className="no-print sticky top-0 z-10 bg-background pb-4">
					<TabsList variant="line" className="w-full">
						{TAB_ITEMS.map((tab) => {
							const tabScore =
								tab.id === "grammar"
									? report.grammar.score
									: tab.id === "vocabulary"
										? report.vocabulary.score
										: tab.id === "fluency"
											? report.fluency.score
											: tab.id === "business"
												? report.businessEnglish.score
												: null;
							return (
								<TabsTrigger key={tab.id} value={tab.id}>
									{tab.label}
									{tabScore !== null ? (
										<span
											className="ml-1.5 inline-block size-2 rounded-full"
											style={{ backgroundColor: scoreColor(tabScore) }}
										/>
									) : (
										<span className="ml-1">🚀</span>
									)}
								</TabsTrigger>
							);
						})}
					</TabsList>
				</div>

				<TabsContent value="grammar" className="space-y-4 pb-6">
					<h2 className="text-lg font-semibold">
						Grammar{" "}
						<span className="text-sm font-normal text-muted-foreground">
							· {report.grammar.score}/100
						</span>
					</h2>
					<GrammarSection grammar={report.grammar} />
				</TabsContent>

				<TabsContent value="vocabulary" className="space-y-4 pb-6">
					<h2 className="text-lg font-semibold">
						Vocabulary{" "}
						<span className="text-sm font-normal text-muted-foreground">
							· {report.vocabulary.score}/100
						</span>
					</h2>
					<VocabularySection vocabulary={report.vocabulary} />
				</TabsContent>

				<TabsContent value="fluency" className="space-y-4 pb-6">
					<h2 className="text-lg font-semibold">
						Fluency{" "}
						<span className="text-sm font-normal text-muted-foreground">
							· {report.fluency.score}/100
						</span>
					</h2>
					<FluencySection fluency={report.fluency} />
				</TabsContent>

				<TabsContent value="business" className="space-y-4 pb-6">
					<h2 className="text-lg font-semibold">
						Business English{" "}
						<span className="text-sm font-normal text-muted-foreground">
							· {report.businessEnglish.score}/100
						</span>
					</h2>
					<BusinessSection businessEnglish={report.businessEnglish} />
				</TabsContent>

				<TabsContent value="tips" className="pb-10">
					<h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
						<span>🚀</span> Your Action Items
					</h2>
					<TipsSection tips={report.tips} />
				</TabsContent>
			</Tabs>
		</div>
	);
}
