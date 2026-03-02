# Session Detail Page UX/UI Polish — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Polish the ReportPage with a dashboard-style header, a new highlights overview strip, score-colored tab indicators, and per-section visual refinements.

**Architecture:** All changes are in `apps/web/src/pages/ReportPage.tsx` and `apps/web/src/lib/format.ts`. No new files needed — everything stays in ReportPage as local components. The Tabs UI component (`apps/web/src/components/ui/tabs.tsx`) is NOT modified; tab dot indicators are rendered as children of `TabsTrigger`.

**Tech Stack:** React, Tailwind CSS, shadcn/ui (Card, Badge, Tabs, Separator, Button), Lucide icons

---

### Task 1: Add `cefrLabel` helper to format.ts

**Files:**
- Modify: `apps/web/src/lib/format.ts`

**Step 1: Add the cefrLabel function**

Add at the end of `apps/web/src/lib/format.ts`:

```ts
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
```

**Step 2: Verify the app still compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add apps/web/src/lib/format.ts
git commit -m "feat(web): add cefrLabel helper for human-readable CEFR names"
```

---

### Task 2: Make ScoreCircle accept a `size` prop

**Files:**
- Modify: `apps/web/src/pages/ReportPage.tsx` — `ScoreCircle` component (lines 81–109)

**Step 1: Update ScoreCircle to support two sizes**

Replace the current `ScoreCircle` function with:

```tsx
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
```

**Step 2: Verify the app still compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add apps/web/src/pages/ReportPage.tsx
git commit -m "feat(web): add size prop to ScoreCircle (sm/lg)"
```

---

### Task 3: Redesign the header card

**Files:**
- Modify: `apps/web/src/pages/ReportPage.tsx` — main return (lines 481–526) and import

**Step 1: Add cefrLabel import**

In `apps/web/src/pages/ReportPage.tsx`, update the import from `../lib/format` to also include `cefrLabel`:

```ts
import { cefrColor, cefrLabel, formatDate, formatDuration, scoreColor } from "../lib/format";
```

**Step 2: Replace the breadcrumb + header card section**

Replace lines 482–526 (from `<div>` through end of header `</Card>`) with:

```tsx
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
```

**Step 3: Remove the old standalone breadcrumb div**

Delete the old `{/* Breadcrumb + export */}` div (lines 483–496 in old code) — it's now merged into the card. This was already handled in step 2 since we replaced the whole block.

**Step 4: Delete MiniScoreCard component**

Remove the entire `MiniScoreCard` function (old lines 111–130) since it's no longer used.

**Step 5: Verify the app compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors

**Step 6: Commit**

```bash
git add apps/web/src/pages/ReportPage.tsx
git commit -m "feat(web): redesign header card with hero score + category rings"
```

---

### Task 4: Add the HighlightsStrip component

**Files:**
- Modify: `apps/web/src/pages/ReportPage.tsx` — add new component + use it in main return

**Step 1: Add the HighlightsStrip component**

Add this component after the `ScoreCircle` function (before the section components):

```tsx
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
```

**Step 2: Insert HighlightsStrip into the main return**

In the `ReportPage` component's return, add the highlights strip between the closing `</Card>` of the header and the `<Tabs>`:

```tsx
			{/* Highlights strip */}
			<HighlightsStrip report={report} onSelectTab={setActiveTab} />
```

**Step 3: Verify the app compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors

**Step 4: Commit**

```bash
git add apps/web/src/pages/ReportPage.tsx
git commit -m "feat(web): add highlights strip with per-category key insights"
```

---

### Task 5: Add score dots to tabs and inline scores in section headers

**Files:**
- Modify: `apps/web/src/pages/ReportPage.tsx` — TAB_ITEMS definition and tabs rendering

**Step 1: Update TAB_ITEMS to include score accessor info**

Replace the `TAB_ITEMS` const and tabs rendering section with:

```tsx
const TAB_ITEMS = [
	{ id: "grammar", label: "Grammar" },
	{ id: "vocabulary", label: "Vocabulary" },
	{ id: "fluency", label: "Fluency" },
	{ id: "business", label: "Business English" },
	{ id: "tips", label: "Tips" },
] as const;
```

(This stays the same — we compute scores dynamically below.)

**Step 2: Replace the tabs rendering**

Replace the entire `<Tabs>` block with:

```tsx
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
```

**Step 3: Verify the app compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors

**Step 4: Commit**

```bash
git add apps/web/src/pages/ReportPage.tsx
git commit -m "feat(web): add score dots to tabs and inline scores in section headers"
```

---

### Task 6: Polish GrammarSection

**Files:**
- Modify: `apps/web/src/pages/ReportPage.tsx` — `GrammarSection` component

**Step 1: Replace GrammarSection**

```tsx
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
```

**Step 2: Verify the app compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add apps/web/src/pages/ReportPage.tsx
git commit -m "feat(web): polish GrammarSection — error count badge, separator, spacing"
```

---

### Task 7: Polish VocabularySection

**Files:**
- Modify: `apps/web/src/pages/ReportPage.tsx` — `VocabularySection` component

**Step 1: Replace VocabularySection**

```tsx
function VocabularySection({ vocabulary }: { vocabulary: VocabularyFeedback }) {
	const maxCount = vocabulary.overused_words.length > 0
		? Math.max(...vocabulary.overused_words.map((w) => w.count))
		: 1;

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
									<div className="mb-2 flex items-center gap-3">
										<span className="text-sm font-semibold">
											&ldquo;{w.word}&rdquo;
										</span>
										<div className="h-1.5 flex-1 rounded-full bg-muted">
											<div
												className="h-1.5 rounded-full"
												style={{
													width: `${(w.count / maxCount) * 100}%`,
													backgroundColor: "#F59E0B",
												}}
											/>
										</div>
										<span className="shrink-0 text-xs text-muted-foreground">
											{w.count}×
										</span>
									</div>
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
					<div className="flex flex-wrap gap-2 rounded-lg border border-green-100 bg-green-50 p-4">
						{vocabulary.good_usage.map((phrase) => (
							<Badge key={phrase} variant="secondary" className="bg-green-100 text-green-800">
								{phrase}
							</Badge>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
```

**Step 2: Verify the app compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add apps/web/src/pages/ReportPage.tsx
git commit -m "feat(web): polish VocabularySection — usage bars, badge chips"
```

---

### Task 8: Polish FluencySection

**Files:**
- Modify: `apps/web/src/pages/ReportPage.tsx` — `FluencySection` component

**Step 1: Replace FluencySection**

```tsx
function FluencySection({ fluency }: { fluency: FluencyFeedback }) {
	const fillers = Object.entries(fluency.filler_words).sort(([, a], [, b]) => b - a);
	const maxCount = fillers[0]?.[1] ?? 1;
	const totalFillers = fillers.reduce((sum, [, count]) => sum + count, 0);

	return (
		<div className="space-y-5">
			<SummaryBox text={fluency.summary} />

			{fillers.length > 0 && (
				<div>
					<div className="mb-3 flex items-center gap-2">
						<h3 className="text-sm font-semibold">Filler Words</h3>
						<Badge variant="secondary">{totalFillers} detected</Badge>
					</div>
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
							<p className="mt-1 text-[10px] text-muted-foreground/60">
								~5 is typical for a 30-min meeting
							</p>
						</CardContent>
					</Card>
					<Card>
						<CardContent className="p-4 text-center">
							<p className="mb-1 text-2xl">✂️</p>
							<p className="text-2xl font-bold">{fluency.incomplete_sentences}</p>
							<p className="mt-1 text-xs text-muted-foreground">Incomplete Sentences</p>
							<p className="mt-1 text-[10px] text-muted-foreground/60">
								~3 is typical for a 30-min meeting
							</p>
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
```

**Step 2: Verify the app compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add apps/web/src/pages/ReportPage.tsx
git commit -m "feat(web): polish FluencySection — total count badge, benchmark refs"
```

---

### Task 9: Update the ReportSkeleton to match new layout

**Files:**
- Modify: `apps/web/src/pages/ReportPage.tsx` — `ReportSkeleton` component

**Step 1: Replace ReportSkeleton**

```tsx
function ReportSkeleton() {
	return (
		<div className="space-y-6">
			{/* Header card skeleton */}
			<Card>
				<CardContent>
					<div className="mb-5 flex items-center justify-between">
						<Skeleton className="h-4 w-48" />
						<Skeleton className="h-8 w-20" />
					</div>
					<Separator className="mb-5" />
					<div className="flex flex-wrap items-center gap-8">
						<div className="flex items-center gap-4">
							<Skeleton className="size-24 rounded-full" />
							<div className="space-y-2">
								<Skeleton className="h-8 w-12" />
								<Skeleton className="h-4 w-28" />
							</div>
						</div>
						<div className="flex flex-1 justify-around gap-2">
							{[1, 2, 3, 4].map((n) => (
								<div key={n} className="flex flex-col items-center gap-1">
									<Skeleton className="size-11 rounded-full" />
									<Skeleton className="h-3 w-14" />
								</div>
							))}
						</div>
					</div>
				</CardContent>
			</Card>
			{/* Highlights strip skeleton */}
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
				{[1, 2, 3, 4].map((n) => (
					<Skeleton key={n} className="h-20 rounded-lg" />
				))}
			</div>
			{/* Tabs skeleton */}
			<div className="space-y-3">
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-32 w-full" />
			</div>
		</div>
	);
}
```

**Step 2: Verify the app compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add apps/web/src/pages/ReportPage.tsx
git commit -m "feat(web): update ReportSkeleton to match new dashboard layout"
```

---

### Task 10: Visual check and final commit

**Step 1: Start the dev server and visually verify**

Run: `cd apps/web && npm run dev`

Check these states in the browser:
- [ ] Loading state shows skeleton matching the new layout
- [ ] Header card: hero score left, CEFR with label, 4 category rings right
- [ ] Highlights strip: 2×2 grid with emoji, title, insight text, score dot
- [ ] Clicking a highlight card switches to the correct tab
- [ ] Tabs have colored score dots next to labels
- [ ] Each tab section header shows "Category · score/100"
- [ ] Grammar: error count badge at top, separator between summary and errors
- [ ] Vocabulary: usage bars on overused words, badge chips for good usage
- [ ] Fluency: total count badge on filler words, benchmark text on speech patterns
- [ ] Business English + Tips: unchanged, still working
- [ ] Export/print still works
- [ ] Mobile responsive: highlights stack to 1 column, header wraps gracefully
