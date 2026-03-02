# MeetFluent — Frontend Dashboard Development Guide

> Schema passo-passo con i prompt da dare a Claude Code per sviluppare la dashboard web.
> Prerequisiti: il backend API (Fase 1-6 della development guide principale) deve essere funzionante.

---

## FASE 0: Pre-requisiti

Prima di iniziare, verifica di avere:

- [ ] Backend API funzionante su `http://localhost:3000`
- [ ] Google OAuth Client ID configurato (lo stesso usato nel backend)
- [ ] Almeno 1-2 report di test nel database (generati con lo script test-e2e)
- [ ] Il monorepo già scaffoldato con `apps/web/` pronto (dalla Fase 1 della guida principale)

Se non hai ancora `apps/web/`, il primo prompt lo creerà.

---

## FASE 1: Scaffolding frontend

### Prompt 1.1 — Setup React app

```
Crea la web app frontend in apps/web.

Setup:
- React 18 + Vite + TypeScript
- Tailwind CSS v4 per lo styling
- React Router v7 per il routing
- Configura il proxy dev verso il backend: /api → http://localhost:3000

Struttura:
apps/web/
├── src/
│   ├── main.tsx              # Entry point
│   ├── App.tsx               # Router setup
│   ├── index.css             # Tailwind imports
│   ├── components/           # Componenti riutilizzabili
│   │   ├── Layout.tsx        # Layout con header e sidebar/nav
│   │   ├── LoadingSpinner.tsx
│   │   └── ProtectedRoute.tsx
│   ├── pages/                # Pagine
│   │   ├── LoginPage.tsx     # Pagina di login
│   │   ├── HomePage.tsx      # Lista report (placeholder)
│   │   ├── ReportPage.tsx    # Dettaglio report (placeholder)
│   │   └── ProfilePage.tsx   # Profilo utente (placeholder)
│   ├── hooks/                # Custom hooks
│   │   └── useAuth.ts        # Auth state management
│   ├── lib/                  # Utility
│   │   ├── api.ts            # API client (fetch wrapper con JWT)
│   │   └── auth.ts           # Google OAuth helpers
│   └── types/                # TypeScript types (o importa da packages/shared)
├── .env.example
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json

Rotte:
- /login          → LoginPage (pubblica)
- /               → HomePage (protetta)
- /sessions/:id   → ReportPage (protetta)
- /profile        → ProfilePage (protetta)

Per ora le pagine protette mostrano solo il titolo e un placeholder.
ProtectedRoute deve redirectare a /login se l'utente non è autenticato.

Design system base:
- Colore primario: #1B6B93 (blu MeetFluent)
- Colore secondario: #F0F7FA (sfondo chiaro)
- Testo: #1A1A1A (scuro), #6B7280 (grigio secondario)
- Font: Inter (importa da Google Fonts) con fallback system-ui
- Border radius: 8px di default
- Spacing consistente con le classi Tailwind

Il Layout deve avere:
- Header con logo "MeetFluent" (testo, non immagine), nav links (Home, Profile), e un avatar/nome utente con dropdown per logout
- Contenuto centrato con max-width 1024px
- Footer minimale (opzionale, può essere omesso per MVP)
```

### Prompt 1.2 — Verifica

```
Fai partire la web app con npm run dev -w web.
Verifica che:
1. La pagina si carica su http://localhost:5173
2. Navigando a / redirecta a /login
3. La pagina di login si vede (anche se il bottone non funziona ancora)
4. Il layout è pulito e i colori sono corretti
Se ci sono errori, fixali.
```

**✅ Checkpoint:** l'app React parte e mostra la pagina di login. Commit: `feat(web): initial frontend scaffolding`

---

## FASE 2: Autenticazione

### Prompt 2.1 — Google Sign-In

```
Implementa il login con Google nella web app.

1. Usa la libreria @react-oauth/google per il login con Google.
   Wrappa l'app con GoogleOAuthProvider usando il GOOGLE_CLIENT_ID
   dall'env (VITE_GOOGLE_CLIENT_ID).

2. LoginPage:
   - Layout centrato verticalmente e orizzontalmente
   - Logo "MeetFluent" grande con il tagline
     "AI-Powered English Coaching for Professionals"
   - Bottone "Sign in with Google" (usa il componente GoogleLogin
     di @react-oauth/google per il bottone ufficiale Google)
   - Sotto il bottone, una riga di testo: "Your voice. Your growth.
     Only your microphone is recorded."

3. Flow di autenticazione:
   - L'utente clicca Sign in with Google
   - Google ritorna un credential (ID token)
   - Invia il token a POST /auth/google del nostro backend
   - Il backend ritorna un JWT
   - Salva il JWT in memoria (React state/context, NON localStorage
     per sicurezza — se vuoi persistenza usa un httpOnly cookie
     lato backend, ma per MVP va bene il context)
   - Redirect a /

4. useAuth hook deve esporre:
   - user: { id, email, name } | null
   - isLoading: boolean
   - login(googleToken: string): Promise<void>
   - logout(): void

5. Quando l'utente fa logout, cancella il JWT e redirecta a /login.

6. API client (lib/api.ts):
   - Funzione fetchApi(path, options) che aggiunge automaticamente
     il JWT nell'header Authorization: Bearer {token}
   - Gestione 401: se il backend risponde 401, fai logout automatico

Aggiungi VITE_GOOGLE_CLIENT_ID e VITE_API_URL al .env.example.
```

### Prompt 2.2 — Persistenza sessione

```
Il JWT in React context si perde al refresh della pagina.
Per l'MVP, aggiungi la persistenza:

1. Salva il JWT in sessionStorage (si cancella quando chiudi il tab,
   più sicuro di localStorage)
2. Al mount dell'app, controlla se c'è un JWT in sessionStorage
3. Se c'è, verifica che sia ancora valido chiamando GET /auth/me
4. Se valido, setta l'utente nel context
5. Se non valido (401), cancella il JWT e mostra la login page
6. Mostra un loading spinner durante il check iniziale

Così l'utente non deve rifare login ad ogni refresh durante
la stessa sessione del browser.
```

### Prompt 2.3 — Testa l'auth

```
Verifica il flusso completo:
1. Vai a http://localhost:5173 → deve mostrare la login page
2. Clicca Sign in with Google → deve aprire il popup Google
3. Dopo il login → deve redirectare a / e mostrare il nome utente nel header
4. Refresh della pagina → deve restare loggato
5. Clicca logout → deve tornare alla login page
6. Refresh → deve restare sulla login page

Se il popup Google non si apre, potrebbe essere un problema di
configurazione del Client ID. Verifica che http://localhost:5173
sia tra gli Authorized JavaScript origins nella Google Cloud Console.

Fixa qualsiasi problema.
```

**✅ Checkpoint:** login e logout funzionano end-to-end. Commit: `feat(web): Google OAuth authentication`

---

## FASE 3: Aggiornamento backend (profilo utente)

### Prompt 3.1 — Aggiorna schema e endpoint per il profilo

```
Dobbiamo supportare nome e cognome separati nel profilo utente.

1. Aggiorna la tabella users nello schema del database:
   - Rinomina 'name' in 'first_name' (varchar, nullable)
   - Aggiungi 'last_name' (varchar, nullable)
   - Mantieni 'email' (non modificabile dal frontend)
   - Aggiungi 'avatar_url' (varchar, nullable) — dalla foto Google
   
   Se 'name' conteneva già dati, splitta su first_name/last_name.

2. Aggiorna POST /auth/google per salvare:
   - first_name dal given_name del Google token
   - last_name dal family_name del Google token
   - avatar_url dalla picture del Google token

3. Aggiorna GET /auth/me per ritornare tutti i nuovi campi.

4. Crea un nuovo endpoint:
   - PATCH /users/me — aggiorna first_name e last_name
     (email NON modificabile). Ritorna l'utente aggiornato.
     Valida che first_name e last_name non siano vuoti se forniti.

5. Aggiorna i tipi in packages/shared.
```

**✅ Checkpoint:** i nuovi endpoint funzionano. Commit: `feat(api): user profile with first/last name`

---

## FASE 4: Home page — Lista report

### Prompt 4.1 — Lista sessioni

```
Implementa la HomePage che mostra la lista dei report dell'utente.

1. Al mount, chiama GET /users/me/sessions per ottenere la lista.

2. Layout della pagina:
   - Titolo "Your Sessions" in alto
   - Se non ci sono sessioni: stato vuoto con icona, testo
     "No sessions yet. Record your first meeting to get started!"
     e un piccolo explainer su come installare l'extension.

3. Lista delle sessioni come cards. Ogni card mostra:
   - Data e ora della sessione (formattata: "Feb 27, 2026 at 2:30 PM")
   - Durata (formattata: "32 min")
   - Status badge:
     - "Processing" → badge giallo con pulse animation
     - "Complete" → badge verde
     - "Error" → badge rosso
   - Se complete: CEFR level (es. "B2") grande e colorato,
     overall score (es. "72/100")
   - Se complete: mini barre di progresso per le 4 categorie
     (grammar, vocabulary, fluency, business) — solo le barre,
     senza dettagli
   - Click sulla card → naviga a /sessions/:id

4. Ordinamento: sessioni più recenti in alto.

5. Se ci sono sessioni in "processing", fai polling ogni 10 secondi
   per aggiornare lo status automaticamente.

6. Design:
   - Cards con bordo leggero, hover con shadow
   - CEFR level con colore che indica il livello:
     A1-A2: #EF4444 (rosso)
     B1: #F59E0B (ambra)
     B2: #10B981 (verde)
     C1-C2: #1B6B93 (blu brand)
   - Score come cerchio con percentuale o barra di progresso
   - Layout responsive: 1 colonna su mobile, 2 su desktop
```

### Prompt 4.2 — Testa la home

```
Verifica che la HomePage funzioni:
1. Con sessioni nel database → mostra le cards correttamente
2. Senza sessioni → mostra lo stato vuoto
3. Click su una card → naviga al report
4. Il polling funziona per sessioni in processing
5. Il layout è responsive (prova a ridimensionare il browser)

Se non hai sessioni di test, crea 2-3 sessioni di test con lo
script test-e2e del backend (con report diversi se possibile).

Fixa qualsiasi problema.
```

**✅ Checkpoint:** la home mostra la lista delle sessioni. Commit: `feat(web): home page with session list`

---

## FASE 5: Pagina profilo

### Prompt 5.1 — Profilo utente

```
Implementa la ProfilePage.

1. Layout:
   - Card centrata con i dati del profilo
   - Avatar dell'utente (dalla foto Google, o un placeholder
     con le iniziali se non disponibile) — cerchio, 80px
   - Campi del form:
     - First name (input text, editabile)
     - Last name (input text, editabile)
     - Email (input text, DISABILITATO, con un tooltip o testo
       "Email cannot be changed" in grigio)
   - Bottone "Save Changes" (disabilitato se non ci sono modifiche)

2. Comportamento:
   - Al mount, popola i campi con i dati da useAuth
   - Quando l'utente modifica first_name o last_name,
     abilita il bottone Save
   - Click Save → PATCH /users/me → mostra toast di conferma
     "Profile updated" → aggiorna i dati nel context auth
   - Gestione errori: mostra messaggio di errore inline se
     la richiesta fallisce

3. Sezione aggiuntiva sotto il form — "Account Info":
   - Member since: data di registrazione (formattata)
   - Subscription: tier corrente (Free/Pro/Team) con badge colorato
   - Per MVP non serve il link per fare upgrade, solo l'info

4. In fondo alla pagina:
   - Link "Sign out" in rosso (stessa funzione del logout nel header)

5. Design:
   - Card con sfondo bianco, padding generoso
   - Input con bordi arrotondati, focus ring col colore brand
   - Toast notification: piccolo banner verde che appare in alto
     a destra e scompare dopo 3 secondi. Implementalo come
     componente riutilizzabile (lo useremo altrove).
```

**✅ Checkpoint:** profilo visualizzabile e modificabile. Commit: `feat(web): user profile page`

---

## FASE 6: Dettaglio report

### Prompt 6.1 — Report page — struttura e header

```
Implementa la ReportPage (prima parte: struttura e header).

La pagina mostra il dettaglio completo di un report per una sessione.

1. Al mount, chiama GET /sessions/:id/report.
   - Se status == 'processing' → mostra stato di attesa con
     animazione e polling ogni 5 secondi
   - Se status == 'error' → mostra messaggio di errore
   - Se status == 'complete' → mostra il report

2. Header del report:
   - Breadcrumb: "Sessions > Report Feb 27, 2026"
   - Riga principale:
     - Data e durata della sessione
     - CEFR Level grande e prominente (es. "B2") con il colore
       corrispondente al livello (stessa scala colori della home)
     - Overall score come cerchio/donut chart con la percentuale
       al centro (es. "72" su 100)
   - Riga secondaria — 4 mini score cards affiancate:
     - Grammar: score + mini barra
     - Vocabulary: score + mini barra
     - Fluency: score + mini barra
     - Business English: score + mini barra
     Ogni card ha un'icona o emoji pertinente e il colore
     della barra riflette il punteggio (rosso < 40, ambra 40-70,
     verde > 70)

3. Navigation tabs sotto l'header per le sezioni del report:
   - "Grammar" | "Vocabulary" | "Fluency" | "Business English" | "Tips"
   - Tab attivo con underline del colore brand
   - Click su un tab scrolla alla sezione corrispondente
     (o filtra il contenuto visibile, scegli l'approccio migliore)

Per ora implementa solo l'header e i tab, il contenuto delle sezioni
lo facciamo nel prossimo prompt.
```

### Prompt 6.2 — Sezione Grammar

```
Implementa la sezione Grammar del report.

Ricorda: il JSON grammar dal backend ha questa struttura:
{
  "score": 70,
  "errors": [
    {
      "original": "I have went to the meeting",
      "corrected": "I have gone to the meeting",
      "rule": "Past participle",
      "explanation": "With 'have', use past participle 'gone', not simple past 'went'."
    }
  ],
  "summary": "Overall good command of tenses..."
}

Layout della sezione:

1. Summary text in alto — il testo "summary" del JSON, in un box
   con sfondo leggero (#F0F7FA).

2. Lista degli errori. Ogni errore è una card che mostra:
   - In alto: il badge "rule" (es. "Past participle") con sfondo
     colorato leggero
   - "Original" — il testo originale in rosso chiaro con
     strikethrough: "I have went to the meeting"
   - "Corrected" — il testo corretto in verde:
     "I have gone to the meeting"
   - "Explanation" — il testo esplicativo in grigio, font leggermente
     più piccolo
   
   Le parole che differiscono tra original e corrected dovrebbero
   essere evidenziate (bold o highlight) se possibile. Se è troppo
   complesso fare il diff, va bene mostrare le frasi intere.

3. Se non ci sono errori: mostra un messaggio positivo tipo
   "No grammar errors detected. Great job!"

4. In fondo: contatore "X errors found in this session"
```

### Prompt 6.3 — Sezione Vocabulary

```
Implementa la sezione Vocabulary del report.

Struttura JSON dal backend:
{
  "score": 75,
  "range_assessment": "Good working vocabulary with over-reliance on basic connectors.",
  "overused_words": [
    { "word": "very", "count": 8, "alternatives": ["extremely", "particularly", "remarkably"] }
  ],
  "good_usage": ["stakeholder alignment", "revenue forecast"]
}

Layout:

1. Range assessment — testo in un box con sfondo leggero, come
   per grammar summary.

2. Sezione "Words to Improve" — le overused words:
   - Ogni parola è una card/riga con:
     - La parola in bold con il conteggio: "very" (used 8 times)
     - Sotto: "Try instead:" seguito dai suggerimenti come chip/badge
       cliccabili (non devono fare nulla al click, è solo styling)
     - I chip hanno sfondo leggero del colore brand

3. Sezione "Good Usage" — le parole/frasi usate bene:
   - Lista con icona check verde accanto a ogni frase
   - Sfondo verde chiaro leggero per dare un senso positivo

4. Se overused_words è vuoto: "Your vocabulary range is excellent!"
   Se good_usage è vuoto: non mostrare la sezione.
```

### Prompt 6.4 — Sezione Fluency

```
Implementa la sezione Fluency del report.

Struttura JSON dal backend:
{
  "score": 68,
  "filler_words": { "uhm": 12, "like": 5, "you know": 3 },
  "false_starts": 4,
  "incomplete_sentences": 2,
  "summary": "Moderate fluency with noticeable hesitation patterns."
}

Layout:

1. Summary in box con sfondo leggero.

2. Sezione "Filler Words" — visualizzazione dei filler:
   - Horizontal bar chart o lista ordinata per frequenza
   - Ogni filler word con il suo conteggio e una barra proporzionale
   - La barra più lunga = il filler più usato
   - Colore delle barre: ambra/arancione (non rosso, i filler
     sono normali nel parlato, non "errori gravi")
   - Sotto il chart: totale filler words e una nota tipo
     "Filler words are natural in speech. Focus on reducing
     the most frequent ones."

3. Sezione "Speech Patterns" — false starts e incomplete sentences:
   - Due metriche affiancate in cards piccole:
     - "False Starts: 4" con icona
     - "Incomplete Sentences: 2" con icona
   - Sotto: una nota breve che spiega cosa sono
     (es. "False starts are when you begin a sentence and restart.
     A few are normal — they show you're self-correcting.")

4. Non serve un chart complesso per MVP — mantienilo pulito
   e leggibile.
```

### Prompt 6.5 — Sezione Business English

```
Implementa la sezione Business English del report.

Struttura JSON dal backend:
{
  "score": 78,
  "strengths": [
    "Clear meeting agenda communication",
    "Effective use of hedging language"
  ],
  "improvements": [
    "Could use more varied phrases for agreeing/disagreeing"
  ]
}

Layout:

1. Due colonne (o due sezioni su mobile):

   Colonna sinistra — "Strengths" (icona: stella o pollice su):
   - Lista con icona check verde per ogni punto
   - Sfondo verde molto chiaro

   Colonna destra — "Areas to Improve" (icona: target):
   - Lista con icona freccia o punto per ogni suggerimento
   - Sfondo ambra molto chiaro

2. Se una delle due liste è vuota, mostra solo l'altra
   a larghezza piena.

3. Mantieni il tono costruttivo — le improvements non sono
   "errori" ma "opportunità". Lo styling deve riflettere questo
   (niente rosso, usa colori neutri o caldi).
```

### Prompt 6.6 — Sezione Tips

```
Implementa la sezione Tips (improvement recommendations).

Struttura JSON dal backend:
{
  "tips": [
    "Focus on past participle forms — practice irregular verbs list.",
    "Try replacing 'very' with more specific intensifiers.",
    "Pause briefly instead of using 'uhm' — silence sounds more confident."
  ]
}

Layout:

1. Titolo: "Your Action Items" (non "Tips" — suona più actionable)

2. Lista numerata dei tips, ogni tip è una card con:
   - Numero grande a sinistra (1, 2, 3...) nel colore brand
   - Testo del tip a destra
   - Un leggero bordo sinistro nel colore brand

3. Design che ispira azione — deve sembrare una todo list,
   non una lista di problemi. Usa un'icona lampadina o razzo
   accanto al titolo.

4. In fondo: un messaggio motivazionale tipo
   "Small consistent improvements lead to big results.
   Focus on one tip at a time."
   In grigio chiaro, corsivo.
```

### Prompt 6.7 — Polish e responsive

```
Fai un review generale della ReportPage e migliora:

1. Responsive design:
   - Su mobile (< 640px): tutto a colonna singola, tabs scrollabili
     orizzontalmente, cards full width
   - Su tablet (640-1024px): layout intermedio
   - Su desktop (> 1024px): layout completo con colonne affiancate
     dove appropriato

2. Loading states:
   - Skeleton loading per l'header e le sezioni mentre il report
     si carica (usa placeholder animati, non spinner)

3. Print-friendly:
   - Aggiungi un bottone "Export Report" nell'header (per MVP può
     semplicemente triggare window.print() con un @media print
     che nasconde header/nav e formatta il report su bianco)

4. Scroll behavior:
   - I tab di navigazione devono essere sticky sotto l'header
   - Click su un tab scrolla smooth alla sezione corrispondente
   - Il tab attivo si aggiorna durante lo scroll (intersection observer)

5. Verifica che i dati del report si rendano correttamente con:
   - Report con molti errori (10+)
   - Report con zero errori in una categoria
   - Report con testi molto lunghi nelle explanation
   - Report con un solo tip

Fixa qualsiasi problema visivo o funzionale.
```

**✅ Checkpoint:** il report è completamente visualizzabile e responsive. Commit: `feat(web): complete report detail page`

---

## FASE 7: Test end-to-end frontend

### Prompt 7.1 — Verifica completa

```
Fai un test end-to-end di tutto il frontend:

1. Login con Google → redirect alla home
2. Home mostra le sessioni (usa dati di test nel database)
3. Click su una sessione → apre il report
4. Tutte le sezioni del report si renderano correttamente
5. Torna alla home con il breadcrumb o il nav
6. Vai al profilo, modifica il nome, salva → toast di conferma
7. Logout → torna alla login page
8. Refresh → resta sulla login page (sessione cancellata)

Se qualcosa non funziona, fixa.
Alla fine, fai un commit pulito.
```

**✅ Checkpoint finale:** la dashboard è funzionante. Commit: `feat(web): complete frontend dashboard`

---

## Note generali

- **Un prompt alla volta.** Non saltare step.
- **Testa sempre.** Ogni prompt ha una verifica implicita — guarda il risultato nel browser prima di andare avanti.
- **Se il design non ti piace,** chiedi a Claude Code di cambiarlo descrivendo cosa non va. Es: "Le cards degli errori grammar sono troppo compatte, aggiungi più padding e spazio tra di esse."
- **Se mancano dati di test,** usa lo script test-e2e del backend per generare report con audio reali prima di lavorare sul frontend.
- **I colori e il layout sono suggerimenti.** Se qualcosa non ti convince visivamente, modifica le indicazioni nel prompt.
- **Rileggere CLAUDE.md** se Claude Code perde il contesto tra una sessione e l'altra.
