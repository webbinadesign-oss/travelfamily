# Webbina Travel AI — Backend Services

TypeScript backend powering **Webbina**, the living AI travel advisor. It exposes a
thin, typed API in front of the external providers so the frontend never holds a
secret and every response speaks the same domain types.

```
Frontend (Webbina Console)
        │  HTTPS / SSE / signed WS URL
        ▼
   /services (this app)  ──►  OpenAI       (Webbina's brain + emotion)
        │                 ──►  ElevenLabs   (voice TTS + Conversational AI agent)
        │                 ──►  Amadeus      (flights & hotels)
        │                 ──►  Google Maps  (places, geocoding)
        │                 ──►  OpenWeather  (weather & forecast)
        ▼
   Supabase (persistence — wire as needed)
```

## ⚠️ Security first — rotate your keys

The keys shared during development must be treated as **compromised** and
**rotated at each provider**. In particular, a Supabase **service_role/secret**
key must NEVER ship to a browser — keep it server-side only.

Rules enforced by this codebase:
- Secrets are read from `process.env` only (`src/config/env.ts`). Nothing is hard-coded.
- `.env` is git-ignored; only `.env.example` (variable **names**) is committed.
- The ElevenLabs API key never reaches the client — the browser gets a short-lived
  **signed URL** instead (`GET /api/voice/agent-url`).

## Setup

```bash
cd services
cp .env.example .env      # then fill in your OWN keys
npm install
npm run dev               # http://localhost:8787
```

Scripts: `dev` (watch), `build` (tsc → dist), `start` (run build), `typecheck`.

## Project structure

```
services/
├─ src/
│  ├─ config/env.ts          # typed env + integrationStatus + validateEnv
│  ├─ types/index.ts         # shared domain types (the API contracts)
│  ├─ lib/
│  │  ├─ ApiError.ts         # normalized error class
│  │  ├─ httpClient.ts       # fetch wrapper: timeout, retry, errors
│  │  └─ logger.ts
│  ├─ middleware/
│  │  ├─ asyncHandler.ts     # forwards async errors
│  │  ├─ errorHandler.ts     # 404 + central error JSON
│  │  └─ validate.ts         # zod request validation
│  ├─ services/
│  │  ├─ amadeus.service.ts      # OAuth2 + flights + hotels
│  │  ├─ openai.service.ts       # structured reply + streaming
│  │  ├─ elevenlabs.service.ts   # TTS + signed agent URL + voices
│  │  ├─ googlemaps.service.ts   # places + geocode + details
│  │  └─ weather.service.ts      # current + daily forecast
│  ├─ routes/                # one router per domain + index
│  ├─ app.ts                 # express app + middleware
│  └─ server.ts              # bootstrap + graceful shutdown
├─ .env.example
├─ package.json
└─ tsconfig.json             # strict, NodeNext, declaration
```

## API routes

| Method | Path | Provider | Purpose |
|--------|------|----------|---------|
| GET  | `/api/health` | — | Liveness + which integrations are configured |
| POST | `/api/chat` | OpenAI | Webbina's reply `{ reply, emotion, suggestions, action }`. `stream:true` → SSE tokens |
| GET  | `/api/voice/agent-url` | ElevenLabs | Signed URL for the browser to open the agent WebSocket |
| POST | `/api/voice/tts` | ElevenLabs | Synthesize speech (audio bytes), expressiveness from `emotion` |
| GET  | `/api/voice/voices` | ElevenLabs | List voices (to pick/clone Webbina's) |
| GET  | `/api/flights/search` | Amadeus | Flight offers |
| GET  | `/api/flights/hotels` | Amadeus | Hotel offers |
| GET  | `/api/places/search` | Google | Text search for places |
| GET  | `/api/places/geocode` | Google | Address → coordinates |
| GET  | `/api/places/:placeId` | Google | Place details |
| GET  | `/api/weather` | OpenWeather | Weather by `lat`/`lng` |
| GET  | `/api/weather/by-place` | Google + OpenWeather | Weather by place name |
| GET  | `/api/memory/:userId/context` | Supabase | Full memory: profile, travelers, passports, prefs, trips, **summary + greeting** |
| GET  | `/api/memory/:userId/greeting` | Supabase | Just the spoken greeting + summary + `returning` flag |
| GET/PUT | `/api/memory/:userId/profile` | Supabase | Travel profile (home airport, cabin, airlines, budget) |
| GET/PUT | `/api/memory/:userId/preferences` | Supabase | Tastes (interests, climates, avoid, children…) |
| GET/POST | `/api/memory/:userId/travelers` | Supabase | Usual travel party |
| GET/POST | `/api/memory/:userId/passports` | Supabase | Passports (number stored encrypted; last4 for display) |
| GET/POST | `/api/memory/:userId/trips` | Supabase | Saved trips / history |
| POST | `/api/memory/:userId/conversation` | Supabase | Append conversation memory (messages/facts/summaries) |
| POST | `/api/memory/:userId/summarize` | Supabase + OpenAI | (Re)generate the preference summary |

## Webbina Memory

Tables (migration `sql/001_webbina_memory.sql`): `users`, `travel_profiles`,
`travelers`, `passports`, `trip_preferences`, `saved_trips`, `conversation_memory`
— all with **RLS** (a user only sees their own rows) and `updated_at` triggers.

On a new conversation, the frontend calls `GET /api/memory/:userId/context`.
`memoryService.getContext()` assembles everything and produces a ready-to-speak
greeting, e.g.:

> « Bonjour, vous voyagez habituellement en classe Premium au départ de
> Marseille. Souhaitez-vous que je recherche des options similaires ? »

`summarize()` builds a one-line preference summary (OpenAI, with a deterministic
fallback so it works even without an LLM) and persists it on `travel_profiles`.

**Security:** passport numbers must be encrypted at rest (`number_enc` via
pgcrypto/Supabase Vault) — only `number_last4` is returned for display. The
backend uses the `service_role` key (bypasses RLS) and **always** scopes queries
by `user_id`. Never expose `service_role` to the browser.

### Real-time voice (ElevenLabs SDK)

The frontend `LiveTransport` loads `@elevenlabs/client` on demand and calls
`Conversation.startSession({ signedUrl })`, where `signedUrl` comes from
`GET /api/voice/agent-url`. SDK events map onto the avatar (mode → state,
message → bubble + emotion, audio level → mouth/pulse). The API key never leaves
the server.

### Example

```bash
curl -X POST http://localhost:8787/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"On veut du soleil en août, 2 adultes 2 enfants, 3000€"}]}'
# → { "reply": "...", "emotion": "enthusiastic", "suggestions": ["..."], "action": {...} }
```

## Error handling

Every failure becomes an `ApiError` and is emitted as:

```json
{ "error": { "status": 400, "code": "bad_request", "message": "Validation failed", "details": { } } }
```

- `400 bad_request` — zod validation failed (see `details`)
- `404 not_found` — unknown route / missing resource
- `429 rate_limited` — provider throttling
- `502 <provider>_error` / `504 upstream_timeout` — upstream failure/timeout
- `503 <provider>_not_configured` — the integration's keys are not set (graceful)
- `500 internal_error` — unexpected

Unconfigured providers return **503** instead of crashing, so you can bring keys
online one at a time (e.g. Amadeus once your credentials are issued).

## Connecting the ElevenLabs agent (`agent_0001kt43rqqte7ks86mzvavmacjs`)

1. Browser calls `GET /api/voice/agent-url`.
2. Server signs the request with the secret key and returns `{ signedUrl }`.
3. Browser opens the WebSocket / uses `@elevenlabs/client` `Conversation.startSession({ signedUrl })`.

The frontend `ElevenLabsTransport` adapter (Webbina Console) is built to consume
exactly this endpoint.

## Next steps

- Add Supabase persistence (trips, passports, voyage memory) in a `supabase.service.ts`.
- Add a rate limiter + auth middleware before exposing publicly.
- Wire Booking.com and ExchangeRate services following the same pattern.
