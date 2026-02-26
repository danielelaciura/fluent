# @meetfluent/api

Backend API server (Fastify + Drizzle ORM + PostgreSQL).

## Setup

### 1. Crea un progetto Supabase

1. Vai su [supabase.com](https://supabase.com) e crea un nuovo progetto
2. Nella dashboard, vai su **Settings → Database**
3. Copia la **Connection string** (URI) dalla sezione "Connection pooling" con modalità **Transaction**
4. Sostituisci `[YOUR-PASSWORD]` con la password del progetto

### 2. Configura le variabili d'ambiente

```bash
cp .env.example .env
```

Modifica `.env` e inserisci la connection string di Supabase:

```
DATABASE_URL=postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
```

### 3. Push dello schema al database

```bash
npm run db:push
```

Questo comando applica lo schema Drizzle direttamente al database senza generare file di migrazione. Utile in fase di sviluppo.

Per generare file di migrazione SQL (utile per CI/CD e produzione):

```bash
npm run db:generate
```

I file di migrazione vengono salvati nella cartella `drizzle/`.

### 4. Avvia il server

```bash
npm run dev
```

Il server parte su `http://localhost:3000`.

### 5. Verifica la connessione

```bash
curl http://localhost:3000/health
```

Risposta attesa:

```json
{ "status": "ok", "db": "connected" }
```

## Script disponibili

| Script | Descrizione |
|--------|-------------|
| `npm run dev` | Avvia il server in modalità watch |
| `npm run build` | Compila TypeScript |
| `npm run start` | Avvia il server compilato |
| `npm run db:generate` | Genera file di migrazione SQL |
| `npm run db:push` | Applica lo schema direttamente al database |
