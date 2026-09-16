# wify

Personal cognitive OS. **Sprint 1** is a local, reversible mail-draft HITL loop:

**Doer → Critic → Approve**

No calendar, no LoRA, no meta-agents, no irreversible actions, no cloud sync, no real OAuth, no secrets.

## Layout

```
apps/approve-ui/          Vite + React + Tailwind Approve card (port 5173)
services/mail-loop/       Local mock API (127.0.0.1:8787)
```

## How to run locally

Requires **Node 22+**. Two terminals.

### 1. Mail loop API — `127.0.0.1:8787`

```bash
cd services/mail-loop
node server.mjs
```

Or from the repo root:

```bash
npm run mail-loop
```

Expected log: `sprint1 mock on http://127.0.0.1:8787 (ai_tell guard on)`

### 2. Approve UI — `http://127.0.0.1:5173`

```bash
cd apps/approve-ui
npm install
npm run dev
```

Or from the repo root (after `npm install` in `apps/approve-ui`):

```bash
npm run approve-ui
```

Open **http://127.0.0.1:5173**. The card loads `GET http://127.0.0.1:8787/local/approve-card?case=pass-to-card`.

Optional query: `http://127.0.0.1:5173/?case=reject-ai-tell` (Critic-rejected fixture; Approve is locked).

## Sprint 1 scope

In:

- Local Doer draft (strips typographic em dashes `—` and other AI tells)
- Critic fail-closed on `ai_tell` / `tone_mismatch` **before** the UI (`ui_shown_at` stays `null`)
- HITL Approve card (Hebrew copy)
- Mock SMTP payload **only after** Approve of a reversible, Critic-passed draft
- QA route `GET /local/qa/critic-before-user` (case-3 is an intentional order bug)

Out:

- Real mail send / real SMTP
- Calendar, LoRA, meta-agents
- Irreversible actions (`risk: irreversible` is 403)
- Cloud sync, OAuth, secrets

## Zero-Trust notes

- Process binds **loopback only** (`127.0.0.1`), not `0.0.0.0`.
- The only declared egress destination is **SMTP**, and it is allowed only after `approved + reversible + session Approve`.
- Sprint 1 **does not send mail**. Approve returns `{ egress: { kind: "smtp", mock: true, delivered: false } }`.
- Critic rejects `ai_tell` (em dash, “as an AI”, …) before the card is pending. Doer must not emit `—`.
- No tokens, no `.env` secrets, no remote model calls.

## API (local mock)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | Liveness + rejection tag enum |
| GET | `/local/approve-card?case=pass-to-card` | Card payload for the UI |
| GET | `/local/rejection-log` | Critic timestamps / tags |
| GET | `/local/qa/critic-before-user` | Order + AI-tell checks |
| GET | `/local/egress-destinations` | SMTP after Approve only |
| POST | `/local/approve` | Mock approve; 403 if Critic rejected |
| POST | `/local/reject` | HITL reject; does not send |

Cases: `pass-to-card`, `reject-before-ui`, `bug-bad-order`, `reject-ai-tell`.

```bash
curl -s http://127.0.0.1:8787/health
curl -s http://127.0.0.1:8787/local/qa/critic-before-user
curl -s http://127.0.0.1:8787/local/approve-card?case=pass-to-card
curl -s -X POST http://127.0.0.1:8787/local/approve \
  -H 'Content-Type: application/json' \
  -d '{"case":"pass-to-card"}'
```

## Tests

```bash
npm test
# or: cd services/mail-loop && node --test
```
