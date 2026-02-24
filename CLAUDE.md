Leggi docs/PRD.md per il contesto completo del progetto.

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