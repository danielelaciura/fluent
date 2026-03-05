# MeetFluent — Product Requirements Document & Technical Architecture

> AI-Powered English Coaching for Professionals
> Version 1.0 — February 2026 | DRAFT

---

## PART 1: PRODUCT REQUIREMENTS DOCUMENT

### 1. Executive Summary

MeetFluent is a Chrome extension that analyzes a professional's spoken English during Google Meet calls and delivers a detailed post-meeting coaching report. The product targets the millions of non-native English speakers across Europe and globally who participate in English-language business meetings every day and lack objective feedback on how they sound.

Unlike language learning apps (Duolingo, Babbel) that focus on structured lessons, MeetFluent provides feedback on real workplace communication — the context where fluency matters most and where improvement is hardest to measure.

### 2. Problem Statement

Non-native English speakers in professional environments face a persistent blind spot: they have no way to objectively assess their spoken English in the context where it matters most — work meetings. Existing solutions either focus on artificial learning scenarios (language apps), require expensive human tutors, or provide generic transcription without language coaching. The result is that professionals plateau at a "good enough" level without clear guidance on how to improve.

### 3. Target User

#### 3.1 Primary Persona

Non-native English-speaking professionals (B1–C1 CEFR level) who regularly participate in English-language meetings as part of their job. Typically based in Europe, Latin America, or Asia. They are motivated by career growth, confidence in communication, and the desire to sound more natural and professional.

#### 3.2 User Characteristics

- Age 25–45, working in tech, consulting, finance, or international companies
- Use Google Meet (primary) for daily/weekly meetings
- Intermediate to upper-intermediate English — functional but aware of limitations
- Willing to pay for professional development tools (€10–30/month range)
- Privacy-conscious — would not want colleagues' audio recorded

### 4. Value Proposition

MeetFluent gives you an expert English coach that attends every meeting with you, silently listens, and delivers personalized feedback afterwards — at a fraction of the cost of a human tutor. Only your voice is analyzed, ensuring complete privacy for other participants.

### 5. Core Features (MVP)

#### 5.1 Chrome Extension — Audio Capture

- **Microphone-only capture:** Records only the user's microphone audio via `getUserMedia()`. No tab audio, no other participants.
- **Session management:** User activates recording with a single click. Visual indicator shows recording is active. Auto-stops when the meeting ends.
- **Audio buffering:** Audio is compressed (Opus codec) and stored locally during the meeting. Uploaded to backend only after the session ends.
- **Minimal footprint:** Extension popup shows recording status, session duration, and a link to the dashboard.

#### 5.2 Speech-to-Text Processing

- **Batch transcription:** Audio is processed post-meeting using Whisper API. No real-time streaming required.
- **Timestamp alignment:** Transcription includes word-level timestamps for precise feedback mapping.
- **Confidence scores:** STT confidence scores are used as a proxy signal for pronunciation clarity.

#### 5.3 AI-Powered Language Analysis

The transcription is analyzed by Claude API with a structured prompt that evaluates:

- **Grammar:** Identification of specific errors with corrections and explanations (e.g., tense misuse, article errors, preposition mistakes).
- **Vocabulary:** Assessment of lexical range, overuse of basic words, and suggestions for more natural/professional alternatives.
- **Fluency markers:** Detection of filler words ("uhm", "like", "you know"), false starts, incomplete sentences, and self-corrections.
- **Business English:** Evaluation of register appropriateness, use of idioms, and meeting-specific language (agreeing, disagreeing, presenting, asking questions).
- **CEFR estimation:** Overall level mapped to the CEFR framework (A1–C2) based on the analyzed dimensions.

#### 5.4 Post-Meeting Report

- **Overall score:** A clear CEFR-mapped score with trend over time.
- **Category breakdowns:** Scores and detailed feedback for each analysis dimension (grammar, vocabulary, fluency, business English).
- **Specific examples:** Excerpts from the transcription with inline corrections and explanations.
- **Improvement tips:** 3–5 actionable recommendations tailored to the user's recurring patterns.
- **Progress tracking:** Dashboard showing scores over time, most common errors, and areas of improvement.

### 6. Future Features (Post-MVP)

| Priority | Feature | Rationale |
|----------|---------|-----------|
| P1 | Pronunciation assessment (Azure Speech) | Core value-add for spoken language coaching |
| P1 | Zoom & Teams support | Expand addressable market significantly |
| P2 | Real-time subtle hints (non-intrusive) | In-meeting nudges for common errors |
| P2 | Team/enterprise plans with manager dashboards | B2B revenue opportunity |
| P2 | Multi-language support (Spanish, French, German) | Geographic expansion |
| P3 | Integration with corporate LMS platforms | Enterprise adoption |
| P3 | Personalized practice exercises based on errors | Deeper learning loop |

### 7. Success Metrics

#### 7.1 North Star Metric

**Weekly Active Analyzed Sessions (WAAS)** — number of meetings analyzed per week across all users. This captures both user acquisition and engagement.

#### 7.2 Key Metrics

| Metric | MVP Target (3 months) | Growth Target (12 months) |
|--------|----------------------|--------------------------|
| WAAS | 500 | 10,000 |
| Activation rate | 60% (1st report within 7 days) | 70% |
| Retention (M1) | 40% | 55% |
| Free → Paid conversion | 8% | 12% |
| NPS | 40+ | 50+ |

### 8. Pricing Model (Draft)

| Tier | Includes | Price |
|------|----------|-------|
| Free | Up to 2 hours of analyzed conversation per week (rolling 7 days), basic grammar + fluency report | €0 |
| Pro | Up to 50 hours/month, premium AI analysis, full report with all categories, progress tracking | €14.99/month |
| Team | Pro features + admin dashboard, team analytics, priority support | €12.99/user/month (min 5 seats) |

Unit economics at Pro tier: estimated COGS of €0.25–0.30 per session. At 8 sessions/month average, COGS is ~€2.20, yielding ~85% gross margin.

Usage limits are enforced via a rolling time window (Free: 7-day rolling, Pro: calendar month tied to subscription period). When a user reaches their limit, the Record button in the Chrome extension is disabled until quota resets. All thresholds are stored in the `plans` database table and configurable via an admin endpoint.

### 9. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Google changes Meet UI/policies | Extension breaks | Abstract audio capture layer; prioritize getUserMedia (stable API); support Zoom/Teams as fallback |
| STT quality for non-native accents | Poor feedback accuracy | Test across accent groups; use confidence scores to flag low-quality transcriptions; allow user correction |
| LLM hallucination in feedback | Wrong corrections erode trust | Structured prompts with examples; confidence thresholds; user feedback loop |
| Privacy concerns / GDPR | Adoption blockers | Mic-only capture; data residency in EU; transparent data policy; no audio stored post-processing |
| Low activation (users forget to use it) | Churn | Onboarding flow; calendar integration; auto-detect meeting start |

---

## PART 2: TECHNICAL ARCHITECTURE

### 10. System Architecture Overview

The system follows a simple three-tier architecture: a Chrome Extension (client), a cloud backend (API + workers), and third-party AI services. The design prioritizes simplicity for the MVP, with clear boundaries that allow scaling individual components independently.

```
┌───────────────────────────────────────────────────────┐
│  CLIENT (Chrome Extension)                            │
│                                                       │
│  ┌────────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │ Mic Capture    │  │ Audio Buffer │  │ Extension │ │
│  │ (getUserMedia) │  │ (Opus/WebM)  │  │ UI        │ │
│  └────────────────┘  └──────┬───────┘  └───────────┘ │
└─────────────────────────────┼─────────────────────────┘
                              │ HTTPS (audio upload)
                              ▼
┌───────────────────────────────────────────────────────┐
│  BACKEND (Cloud)                                      │
│                                                       │
│  ┌──────────────┐  ┌────────────┐  ┌───────────────┐ │
│  │ API Server   │  │ Job Queue  │  │ Worker        │ │
│  │ (Fastify)    │  │ (BullMQ)   │  │ (Processing)  │ │
│  └──────┬───────┘  └──────┬─────┘  └───────┬───────┘ │
│         │                 │                 │         │
│  ┌──────┴─────────────────┴─────────────────┴──────┐  │
│  │              Database (PostgreSQL)               │  │
│  │  users | sessions | transcriptions | reports     │  │
│  └─────────────────────────────────────────────────┘  │
└───────────────────────────┬───────────────────────────┘
                            │
              ┌─────────────┼──────────────┐
              ▼             ▼              ▼
     ┌────────────┐  ┌────────────┐  ┌────────────┐
     │  Whisper   │  │  Claude    │  │   Azure    │
     │  (STT)     │  │  (Analysis)│  │  Speech    │
     │            │  │            │  │  (Pronun.) │
     └────────────┘  └────────────┘  └────────────┘
     3RD PARTY AI SERVICES (post-MVP for Azure)
```

### 11. Component Details

#### 11.1 Chrome Extension

**Tech stack:** Manifest V3, TypeScript, Opus codec via MediaRecorder API.

Key responsibilities:
- Capture microphone audio via `getUserMedia()` — this is a stable, well-supported browser API that does NOT depend on Google Meet's internal implementation.
- Compress audio in real-time using Opus codec (via MediaRecorder with `audio/webm;codecs=opus`). A 30-minute meeting produces approximately 3–5 MB of audio.
- Buffer audio locally as a Blob during the meeting. No data leaves the browser until the session ends.
- Detect meeting end (tab close, URL change, or manual stop) and trigger upload to the backend via a signed upload URL.
- Authenticate user via OAuth 2.0 (Google Sign-In) and manage session state.

#### 11.2 Backend API

**Tech stack:** Node.js (Fastify), hosted on Railway or Render. PostgreSQL (Supabase) for persistence. BullMQ (Redis) for job queue.

Key endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Google OAuth login, returns JWT |
| POST | `/sessions/upload-url` | Returns a pre-signed S3/R2 URL for audio upload |
| POST | `/sessions/{id}/process` | Triggers the analysis pipeline |
| GET | `/sessions/{id}/report` | Returns the generated report |
| GET | `/users/me/dashboard` | Returns aggregated stats and progress data |

#### 11.3 Processing Pipeline (Worker)

The worker picks jobs from the queue and executes the following pipeline sequentially:

1. **Audio retrieval:** Download audio from S3/R2.
2. **Speech-to-Text:** Send audio to Whisper API. Receive transcription with word-level timestamps and confidence scores.
3. **Language analysis:** Send transcription to Claude API with a structured prompt. The prompt includes the CEFR rubric, error taxonomy, and output JSON schema. The LLM returns structured feedback.
4. **Pronunciation assessment (P1 post-MVP):** Send audio segments to Azure Speech Pronunciation Assessment API. Receive phoneme-level scores.
5. **Report generation:** Combine all analysis results into a structured report object. Store in database.
6. **Notification:** Send email/push notification to user that the report is ready.

**Processing time estimate:** 2–4 minutes for a 30-minute meeting (dominated by STT processing).

#### 11.4 Frontend Dashboard

**Tech stack:** React + Vite + Tailwind CSS + Recharts.

Key views:
- **Session report:** Full analysis with overall score, category breakdowns, specific examples with corrections, and improvement tips.
- **Progress dashboard:** Score trends over time (line chart), most common errors (recurring patterns), vocabulary growth, and fluency metrics.
- **Settings:** Account management, notification preferences, target CEFR level goal.

#### 11.5 Admin Dashboard

The purpose of this app is to provide an internal tool with dashboard and lists to special some users (e.g CEO, PM, Marketing) in order to take everything the control of clients and subscription

**Tech stack:** React + Vite + Tailwind CSS + Recharts.

Key views:
- **User management:** Full user management (add, edit, deactivate, delete), subscription plan manual change, User metric
- **Subscription management:** Limits change.
- **Analytics:** Dashboards, metrics. 

### 12. Data Model

| Table | Key Fields | Notes |
|-------|-----------|-------|
| `users` | id, email, name, created_at | Google OAuth profile |
| `sessions` | id, user_id, duration_sec, audio_url, status, created_at | Status: uploading → processing → complete → error |
| `transcriptions` | id, session_id, text, words_json (timestamps + confidence) | Deleted after report generation (privacy) |
| `reports` | id, session_id, overall_score, cefr_level, grammar_json, vocabulary_json, fluency_json, tips_json | Structured JSON for each analysis category |
| `user_progress` | id, user_id, date, avg_score, common_errors_json | Daily aggregation for dashboard charts |
| `plans` | id, name, max_seconds_per_period, period_type, analysis_provider, stt_provider, price_cents, is_active | Plan configuration (free, pro, team) |
| `subscriptions` | id, user_id, plan_id, status, stripe_subscription_id, stripe_customer_id, current_period_start, current_period_end | One active subscription per user; links user to plan |
| `usage_records` | id, user_id, session_id, duration_seconds, recorded_at | Logs each session's duration for quota calculation |

**Privacy policy:** Raw audio files are deleted from S3/R2 within 24 hours of processing. Transcriptions are deleted after report generation. Only the structured report and aggregated progress data are retained long-term.

### 13. Infrastructure & Estimated Costs

#### 13.1 Per-Session Cost Breakdown

| Service | Cost (30-min session) | Notes |
|---------|----------------------|-------|
| Whisper API (STT) | €0.10–0.15 | ~$0.006/min |
| Claude API (Analysis) | €0.03–0.08 | Depends on transcript length and model |
| Azure Speech (Pronunciation) | €0.05–0.10 | Post-MVP; ~$1/hr of audio |
| S3/R2 Storage (temporary) | < €0.01 | Audio deleted within 24h |
| **Total per session (MVP)** | **€0.15–0.25** | Without pronunciation |
| **Total per session (Full)** | **€0.20–0.35** | With pronunciation |

#### 13.2 Infrastructure Costs (Monthly)

| Component | Early Stage (< 500 users) | Growth (5,000 users) |
|-----------|--------------------------|---------------------|
| Backend hosting | €20–50 (Railway/Render) | €150–300 (AWS ECS) |
| PostgreSQL | €0–15 (Supabase free) | €50–100 (RDS) |
| Redis/Queue | €0–10 | €30–50 |
| S3/Storage | < €5 | €10–20 |
| **Total fixed** | **€30–80/month** | **€250–500/month** |

### 14. Tech Stack Summary

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Chrome Extension | TypeScript, Manifest V3 | Modern standard, required for Chrome Web Store |
| Backend API | Node.js + Fastify | Fast, lightweight, good async support |
| Database | PostgreSQL (Supabase) | Reliable, JSON support for reports, free tier |
| Job Queue | BullMQ (Redis) | Simple, reliable job processing |
| Object Storage | Cloudflare R2 | S3-compatible, generous free tier |
| STT | OpenAI Whisper API | Best accuracy for non-native speakers |
| LLM Analysis | Claude API (Anthropic) | Strong structured output, nuanced language analysis |
| Pronunciation | Azure Speech (post-MVP) | Only mainstream option with phoneme-level assessment |
| Frontend | React + Vite + Tailwind + Recharts | Fast development, good data visualization |
| Auth | Google OAuth 2.0 | Natural fit (users already have Google accounts for Meet) |
| Hosting | Railway (MVP) → AWS (scale) | Start simple, migrate when needed |
| Payments | Stripe | Standard for SaaS |

### 15. MVP Development Plan

#### Phase 1 — Foundation (Weeks 1–3)
- Chrome Extension: mic capture, audio buffering, session management, basic popup UI
- Backend: auth (Google OAuth), upload endpoint, database schema on Supabase
- Infrastructure: Railway setup, R2 bucket, CI/CD pipeline with GitHub Actions

#### Phase 2 — Pipeline (Weeks 4–6)
- STT integration (Whisper API) with error handling and retries
- LLM analysis prompt engineering and iteration (expect 1–2 weeks of prompt refinement)
- Report data model and generation logic
- Job queue implementation with BullMQ

#### Phase 3 — Dashboard & Polish (Weeks 7–9)
- Frontend dashboard: session report view, progress charts
- Email notifications (report ready)
- Onboarding flow and Chrome Web Store listing preparation
- Beta testing with 10–20 users, prompt refinement based on feedback

#### Phase 4 — Launch (Week 10)
- Public launch on Chrome Web Store
- Landing page and initial marketing
- Payment integration (Stripe) for Pro tier
- Monitoring and alerting setup

**Total estimated time to MVP:** 8–10 weeks for a solo developer or small team (1–2 developers). The Chrome Extension and prompt engineering are the two areas that will likely take longer than expected.

### 16. Open Questions

- Should we offer Whisper self-hosted (cheaper at scale but requires GPU infra) or stick with the API?
- What's the right balance between detailed feedback and overwhelming the user? Need to test report length/depth.
- Should the free tier analyze the full meeting or just the first 10 minutes? (Cost control vs. value demonstration)
- How do we handle very short meetings (< 5 min)? Is there enough data for meaningful analysis?
- Should we build a mobile app for viewing reports, or is a responsive web dashboard sufficient for MVP?
- Patent/IP landscape — are there existing patents around meeting-based language assessment?