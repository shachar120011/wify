# data/whatsapp

Local WhatsApp ingest for wify. Never commit session or exported chats.

| Path | What |
| --- | --- |
| `auth/` | Baileys linked-device session. Gitignored. |
| `store/` | Cached chats/messages after sync. Gitignored. |
| `export/` | JSON + Markdown dumps from **ייצא התכתבויות**. Gitignored. |

Start live loop: `npm run whatsapp-loop` then open `http://127.0.0.1:5173/whatsapp`.
