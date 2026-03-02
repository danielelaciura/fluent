# Session Detail Page UX/UI Polish — Design

**Date:** 2026-03-02
**Goal:** Improve content organization and visual polish of the ReportPage, with a data-rich dashboard feel.
**Approach:** Dashboard Header — add highlights overview, refine header card, polish tab content.

---

## 1. Header Card Redesign

**File:** `apps/web/src/pages/ReportPage.tsx` (lines 498–526)

### Changes

- **Top bar:** Merge breadcrumb row with the header card. Date + duration on the left, Export button on the right, all inside the card.
- **Hero score (left):** Combine the overall ScoreCircle + CEFR level into one hero element. Show the CEFR badge below the circle with a human-readable label (e.g., "Upper Intermediate").
- **Category scores (right):** Replace MiniScoreCards with 4 smaller radial progress rings (reuse ScoreCircle at ~48px) arranged in a horizontal row. Each ring shows score number inside + category label below.
- **Layout:** CSS Grid — hero score takes left column, category rings take right column.

### CEFR Labels

| Level | Label |
|-------|-------|
| A1 | Beginner |
| A2 | Elementary |
| B1 | Intermediate |
| B2 | Upper Intermediate |
| C1 | Advanced |
| C2 | Proficient |

---

## 2. Highlights Strip (New Section)

**Position:** Between header card and tabs.

### Structure

A 2×2 grid of compact insight cards. Each card shows:
- Category emoji + name
- One key takeaway extracted from the report data
- Small colored dot (green/amber/red) based on category score

### Data Extraction Logic

| Category | Highlight text |
|----------|---------------|
| Grammar | `{n} errors found` + most common rule (from first error's `rule` field) |
| Vocabulary | Most overused word + count, or "Excellent range" if none |
| Fluency | Total filler word count + most frequent filler word |
| Business | `{n} strengths · {m} to improve` + first strength text |

### Behavior

- Clicking a highlight card switches to the corresponding tab.
- Cards use the same `Card` component with slightly reduced padding.

---

## 3. Tab Visual Refinements

**File:** `apps/web/src/pages/ReportPage.tsx` (lines 528–538)

### Changes

- **Score dot per tab:** Add a small colored circle (8px) next to each tab label. Color derived from `scoreColor(categoryScore)`. Tips tab gets a static rocket emoji instead.
- **Active tab color:** The underline indicator uses the active category's score color instead of the default primary color.
- **Section headers:** Show score inline — e.g., "Grammar · 68/100".
- **Content spacing:** Increase vertical padding within TabsContent. Add `<Separator>` between sub-sections in each tab.

---

## 4. Per-Section Polish

### Grammar
- Move error count from bottom-right to a Badge at the top of the error list (e.g., "3 errors").
- Add `<Separator>` between SummaryBox and error list.
- Increase card padding slightly for more breathing room.

### Vocabulary
- Add small horizontal usage bars to "Words to Improve" cards (showing relative frequency, like fluency's filler word bars).
- "Good Usage" items: render as Badge chips instead of a plain checkmark list.

### Fluency
- Add total filler word count label above the bar chart (e.g., "8 filler words detected").
- Speech Patterns cards: add benchmark reference text (e.g., "5 is typical for a 30-min meeting").

### Business English
- No structural changes. Already clean.

### Tips
- No changes. Numbered cards with left border work well.

---

## 5. Components to Create/Modify

| Component | Action | Notes |
|-----------|--------|-------|
| `ScoreCircle` | Add `size` prop | Support 96px (current) and 48px (for category rings) |
| `MiniScoreCard` | Remove | Replaced by small ScoreCircle rings |
| `HighlightsStrip` | Create | New 2×2 grid component extracting key insights |
| `TabsTrigger` | Modify styling | Add score dot, colored active indicator |
| `GrammarSection` | Polish | Error count badge at top, separator, spacing |
| `VocabularySection` | Polish | Usage bars, badge chips for good usage |
| `FluencySection` | Polish | Total count label, benchmark references |

---

## 6. No Changes

- Processing/error states — already fine.
- Print/export functionality — unchanged.
- Data fetching/polling logic — unchanged.
- Mobile responsiveness approach — unchanged (highlight grid stacks to 1 column on mobile).
