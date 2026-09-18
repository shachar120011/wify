# wify

Personal cognitive OS. **Sprint 1** is a local, reversible mail-draft HITL loop; Identity Approve is a sibling HITL screen in the same UI:

**Doer → Critic → Approve**

WhatsApp ingest is a separate local slice: link the phone as a companion device and export chats to disk. No send.

No calendar, no LoRA, no meta-agents, no irreversible actions, no cloud sync, no real OAuth.

## Layout

```
apps/approve-ui/          Vite + React + Tailwind Approve UI (port 5173)
                          / mail HITL · /identity identity HITL · /whatsapp ingest
services/mail-loop/       Local mock API (127.0.0.1:8787)
services/whatsapp-loop/   Local WhatsApp Web companion + export (127.0.0.1:8789)
identity-loop             Parallel backend on 127.0.0.1:8788 (not in this repo)
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

Open **http://127.0.0.1:5173**. The mail card loads `GET /local/approve-card?case=pass-to-card` via the Vite proxy to `127.0.0.1:8787`.

Optional query: `http://127.0.0.1:5173/?case=reject-ai-tell` (Critic-rejected fixture; Approve is locked).

### 3. Identity Approve — `http://127.0.0.1:5173/identity`

Same Vite app, `/identity` mode. The identity card talks to **identity-loop on `127.0.0.1:8788`** (may land in parallel).

```bash
cd apps/approve-ui
npm install
npm run dev
```

Then open **http://127.0.0.1:5173/identity**. Default case is `pass-like-me`.

| What | Where |
| --- | --- |
| UI | `http://127.0.0.1:5173/identity` |
| identity-loop | `http://127.0.0.1:8788` |
| Vite proxy (default) | `/id-api` → `:8788` (so identity `/local/egress-destinations` does not hit mail-loop) |
| Direct API | `VITE_IDENTITY_LOOP_BASE=http://127.0.0.1:8788` |
| UI-only smoke | `http://127.0.0.1:5173/identity?mock=1` or `VITE_IDENTITY_MOCK=1` |

Copy `apps/approve-ui/.env.example` if you need to override the base URL. Mock mode does not add egress, send, calendar, or LoRA — it only fixtures the card so the UI can be exercised without identity-loop.

Identity contract:

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/local/identity/card?case=pass-like-me` | `prompt`, `draft`, `critic_score`, `reject_reason`, `fit_tags`, `risk`, `status` |
| POST | `/local/identity/verdict` | כמוני: `{ case, risk, status: "approved", verdict: "like_me" }` |
| POST | `/local/identity/verdict` | לא כמוני: `{ case, risk, status: "rejected", verdict: "not_like_me", reject_reason }` (empty reason → 400) |
| GET | `/local/egress-destinations` | Identity expects `[]` (UI shows אין יעד יוצא) |

`enforceApproveIntent` is the same as mail: missing `risk`/`status` → 400; `irreversible` → 403; `status≠approved` when approving → 403. The UI always sends `risk` from the loaded card plus the intended `status`.

### 4. WhatsApp export — `http://127.0.0.1:5173/whatsapp`

Local companion device (Baileys). Loopback only. **Read/export, never send.** Session files stay in `data/whatsapp/auth/` (gitignored).

```bash
cd services/whatsapp-loop
npm install
node server.mjs
```

Or from the repo root (after `npm install` in `services/whatsapp-loop`):

```bash
npm run whatsapp-loop
```

Then in the UI: **וואטסאפ** → scan the QR from WhatsApp → Linked devices → **ייצא התכתבויות**.

| What | Where |
| --- | --- |
| UI | `http://127.0.0.1:5173/whatsapp` |
| whatsapp-loop | `127.0.0.1:8789` |
| Vite proxy | `/wa-api` → `:8789` |
| Direct API | `VITE_WHATSAPP_LOOP_BASE=http://127.0.0.1:8789` |
| UI-only smoke | `http://127.0.0.1:5173/whatsapp?mock=1` or `WHATSAPP_MOCK=1 npm run whatsapp-loop:mock` |
| Export files | `data/whatsapp/export/<timestamp>/` (JSON + Markdown, gitignored) |

WhatsApp contract:

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/local/whatsapp/status` | `state`: connecting / qr / connected. `qr` is a data URL while waiting |
| GET | `/local/whatsapp/chats` | Synced conversations after link |
| GET | `/local/whatsapp/messages?jid=` | Messages for one chat |
| POST | `/local/whatsapp/connect` | Start / resume the companion session |
| POST | `/local/whatsapp/pairing-code` | `{ phone }` → 8-digit linked-device code |
| POST | `/local/whatsapp/export` | Write JSON+Markdown under `data/whatsapp/export`. `sent: false` |
| POST | `/local/whatsapp/send` | Always **403** |
| GET | `/local/egress-destinations` | `[]` |

History arrives from WhatsApp after the first link (`messaging-history.set`). Older threads may be incomplete, same limit as WhatsApp Web.

## Sprint 1 scope

In:

- Local Doer draft (strips typographic em dashes `—` and ellipsis `…` to ASCII)
- Critic fail-closed on remaining `ai_tell` / `tone_mismatch` **before** the UI (`ui_shown_at` stays `null`)
- HITL Approve card (Hebrew copy)
- Identity HITL at `/identity` (כמוני / לא כמוני) against identity-loop `:8788`
- Mock SMTP payload **only after** Approve of a reversible, Critic-passed draft
- QA route `GET /local/qa/critic-before-user` (case-3 is an intentional order bug)
- WhatsApp local companion on `:8789` + JSON/Markdown export (no send)

Out:

- Real mail send / real SMTP
- Calendar, LoRA, meta-agents
- Irreversible actions (`risk: irreversible` is 403)
- Cloud sync, OAuth
- WhatsApp send (`POST /local/whatsapp/send` is 403)

## Zero-Trust notes

- Process binds **loopback only** (`127.0.0.1`), not `0.0.0.0`.
- CORS allowlists `http://127.0.0.1:5173` (and `localhost:5173`). The UI also proxies `/local` through Vite so the browser stays same-origin.
- The only declared egress destination is **SMTP**, and it is allowed only after `approved + reversible + session Approve`.
- `POST /local/approve` requires the body to declare `risk: "reversible"` and `status: "approved"`. Missing fields are 400; `irreversible` or any other status is 403. The materialized case is still checked (critic / `ai_tell`).
- Sprint 1 **does not send mail**. Approve returns `{ egress: { kind: "smtp", mock: true, delivered: false } }`.
- Doer strips `—` / `–` / `…`. Critic still rejects leftover `ai_tell` (em dash, “as an AI”, …) before the card is pending.
- No tokens, no `.env` secrets, no remote model calls.
- WhatsApp session (`data/whatsapp/auth/`) and exported chats stay on disk and are gitignored. The loop never sends messages.

## API (local mock)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | Liveness + rejection tag enum |
| GET | `/local/approve-card?case=pass-to-card` | Card payload for the UI |
| GET | `/local/rejection-log` | Critic timestamps / tags |
| GET | `/local/qa/critic-before-user` | Order + AI-tell checks |
| GET | `/local/egress-destinations` | SMTP after Approve only |
| POST | `/local/approve` | Body must include `risk` + `status`. 400 if missing; 403 if not `reversible`+`approved`, critic-rejected, or `ai_tell` |
| POST | `/local/reject` | HITL reject; does not send |

Cases: `pass-to-card`, `reject-before-ui`, `bug-bad-order`, `reject-ai-tell`.

```bash
curl -s http://127.0.0.1:8787/health
curl -s http://127.0.0.1:8787/local/qa/critic-before-user
curl -s http://127.0.0.1:8787/local/approve-card?case=pass-to-card
curl -s -X POST http://127.0.0.1:8787/local/approve \
  -H 'Content-Type: application/json' \
  -d '{"case":"pass-to-card","risk":"reversible","status":"approved"}'
```

## Tests

```bash
npm test
# mail-loop + whatsapp-loop
# or: cd services/whatsapp-loop && node --test

cd apps/approve-ui && npm test   # identity + whatsapp helpers
cd apps/approve-ui && npm run build
```
