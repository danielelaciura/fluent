# Phase C — Groq Integration (ON HOLD)

> **STATUS: ON HOLD** — This phase is not currently planned for implementation.
> It is documented here for future reference when we decide to add Groq as
> an alternative provider for the Free tier.
>
> Prerequisites: Phase A (subscription infrastructure) is complete.

---

## Overview

Add Groq as an alternative STT and LLM provider, enabling cost-differentiated
tiers where the Free plan uses cheaper Groq models and the Pro plan uses
premium OpenAI/Anthropic models.

When implemented, the provider routing would be:

| Tier | STT Provider | Analysis Provider |
|------|-------------|-------------------|
| Free | Groq Whisper | Groq (Llama) |
| Pro | OpenAI Whisper | Anthropic (Claude) |
| Team | OpenAI Whisper | Anthropic (Claude) |

The `plans` table already has `stt_provider` and `analysis_provider` columns
(added in Phase A) — this phase implements the actual provider switching logic.

---

## FASE 1: Groq STT service

### Prompt 1.1 — Groq STT integration

```
Add Groq as an STT provider alongside the existing Whisper integration.

1. Install groq-sdk (npm install groq-sdk) in apps/api.

2. Create apps/api/src/services/stt/groq-stt.ts:
   - transcribeWithGroq(audioBuffer: Buffer): Promise<TranscriptionResult>
   - Uses the Groq Whisper endpoint
   - Use model 'whisper-large-v3-turbo' (fastest, cheapest)
   - Request verbose_json response format for timestamps
   - Return the same TranscriptionResult type as the existing
     Whisper integration: { text, words: [{word, start, end}] }

3. Create apps/api/src/services/stt/openai-stt.ts:
   - Rename/move the existing Whisper transcription code here.

4. Create apps/api/src/services/stt/index.ts:
   - Export a factory function: getSTTProvider(provider: 'groq' | 'openai')
     that returns the appropriate transcribe function.

5. Add GROQ_API_KEY to .env.example.
```

---

## FASE 2: Groq LLM analysis service

### Prompt 2.1 — Groq LLM analysis

```
Add Groq as an LLM analysis provider for the Free tier.

1. Create apps/api/src/services/analysis/groq-analysis.ts:
   - analyzeWithGroq(text: string): Promise<AnalysisResult>
   - Uses the Groq API with model 'llama-3.3-70b-versatile'
     (good balance of quality and cost)
   - Use the SAME analysis prompt as the Claude analysis
     (extract it to a shared file if not done already)
   - The prompt must request JSON output only
   - Parse the response and return the same AnalysisResult type

2. Create apps/api/src/services/analysis/claude-analysis.ts:
   - Rename/move the existing Claude analysis code here.

3. Create apps/api/src/services/analysis/index.ts:
   - Export a factory function:
     getAnalysisProvider(provider: 'groq' | 'anthropic')
     that returns the appropriate analyze function.

4. Important: the analysis prompt must be in a single shared file
   apps/api/src/services/analysis/prompt.ts so that both providers
   use the exact same instructions. The only difference is the model.
```

---

## FASE 3: Pipeline update — tier-based provider routing

### Prompt 3.1 — Update processing pipeline

```
Update the session processing worker to select providers based
on the user's subscription plan.

1. When processing a session:
   - Look up the user's subscription → plan
   - Get stt_provider and analysis_provider from the plan
   - Use getSTTProvider(plan.stt_provider) for transcription
   - Use getAnalysisProvider(plan.analysis_provider) for analysis

2. Log which providers are being used for each session:
   "Processing session {id} with STT={stt_provider}, Analysis={analysis_provider}"

3. If a provider fails, do NOT fall back to the other provider.
   Mark the session as 'error' with a clear message.
   We don't want free users accidentally consuming Pro resources.

4. Update the test-e2e.ts script to test both provider paths.
   Add a flag: --tier=free or --tier=pro to select which to test.
```

---

## Environment variables

When this phase is implemented, add to `.env.example`:

```
# Groq (Phase C)
GROQ_API_KEY=your_groq_api_key
```

And update the `plans` seed data to differentiate providers:

```
UPDATE plans SET stt_provider = 'groq', analysis_provider = 'groq' WHERE id = 'free';
```

---

## Notes

- This phase is ON HOLD because the cost savings from Groq may not justify the added complexity at MVP stage.
- Quality differences between Groq Llama and Claude for language analysis need to be evaluated before committing to this approach.
- The provider factory pattern allows easy addition of new providers in the future.
