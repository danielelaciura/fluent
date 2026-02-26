Leggi docs/PRD.md per il contesto completo del progetto.

## Documentazione librerie
Quando lavori con le librerie di questo progetto, usa SEMPRE Context7
per cercare la documentazione aggiornata prima di scrivere codice.
In particolare per: Fastify, Drizzle ORM, BullMQ, MediaRecorder API,
Chrome Extension Manifest V3, @aws-sdk/client-s3.

Non fare affidamento sulla tua conoscenza pregressa per le API di
queste librerie — cerca sempre prima la documentazione corrente.

Crea la struttura del monorepo con npm workspaces (no Turborepo per ora,
lo aggiungiamo dopo). La struttura deve essere:

meetfluent/
├── apps/
│   ├── api/        # Node.js + Fastify backend
│   └── web/        # React + Vite frontend (lo creiamo dopo)
├── packages/
│   └── shared/     # Tipi TypeScript condivisi
├── docs/
│   └── PRD.md      # (già presente)
├── CLAUDE.md       # (già presente)
└── package.json    # Root workspace

Per ogni package:
- TypeScript in strict mode
- ESM modules ("type": "module")
- Biome per linting/formatting

Per apps/api:
- Fastify come framework
- dotenv per env vars
- Un .env.example con tutte le variabili necessarie (vedi CLAUDE.md)
- Un src/index.ts che fa partire il server su porta 3000

Per packages/shared:
- Esporta i tipi TypeScript per User, Session, Report, TranscriptionWord

Non installare ancora dipendenze per database, queue, o AI services.
Solo la struttura base che compila e fa partire un server vuoto.

## Known limitation: Long recordings (1+ hour)

The current architecture does NOT support recordings longer than ~20 minutes.
This needs to be addressed before production use.

### Showstoppers

1. **Whisper API 25MB hard limit** — A 1-hour recording at opus bitrate is
   60-120MB (2-5x over the limit). The API rejects it immediately.
2. **Base64 in-memory transfer** — The offscreen recorder converts the entire
   audio to base64 and sends it via `chrome.runtime.sendMessage`. For 1 hour
   this means 240-320MB of memory in the extension (will crash).

### Bottleneck map

| Stage | Issue | 1hr risk |
|-------|-------|----------|
| Offscreen recorder (recorder.ts) | All chunks + base64 in memory | HIGH |
| Service worker (service-worker.ts) | atob() + byte-by-byte copy | HIGH |
| Fetch upload (api.ts) | Single monolithic POST | MEDIUM |
| Fastify limit (index.ts) | 200MB (barely enough) | OK |
| API buffer (sessions.ts) | Buffer.concat() in memory | MEDIUM |
| **Whisper API (transcription.ts)** | **25MB hard limit** | **FAILS** |

### Numbers

- Opus @ 20-48 kbps: 60min = 60-120MB raw, 80-160MB base64
- Memory peak in extension: ~240-320MB (offscreen + service worker copies)
- Memory peak on server: ~240MB per upload (buffer + S3 + worker)

### Fix direction

Split audio into ~5-minute chunks during recording. Transcribe each chunk
separately (stays under Whisper's 25MB limit). Stream chunks to the API
instead of accumulating the full recording in memory. This solves both
the memory and the Whisper limit issues at once.
