# wify

Sprint 1 Approve email UI — Vite + React + TypeScript + Tailwind.

Hebrew RTL card that loads a live draft from the local loopback worker, shows critic score, and lets you Approve / Reject before anything is sent.

## Run

```bash
npm install
npm run dev
```

The Vite app serves the UI (typically `http://localhost:5173`). It talks to a **local :8787 loop** — start that worker first:

- `GET http://127.0.0.1:8787/local/approve-card?case=pass-to-card` — live card payload
- `POST http://127.0.0.1:8787/local/approve` with `{"case":"pass-to-card"}` — Approve

The card will not load without that loop running.

## Sprint 1 contract

- **טיוטה** uses `draft.subject` / `draft.body`
- **מה יוצא החוצה** uses API `to` / `subject` / `body` only (never draft)
- Critic score from `critic_score`
- Irreversible risk is hidden — the card is not shown
