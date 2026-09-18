import { Download, QrCode, Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { WhatsappChat, WhatsappExportResult, WhatsappStatus } from './whatsapp'
import { statusLabel, whatsappMockFromSearch } from './whatsapp'
import {
  fetchWhatsappChats,
  fetchWhatsappStatus,
  postWhatsappConnect,
  postWhatsappExport,
  postWhatsappPairingCode,
  whatsappMockEnabled,
} from './whatsappApi'

export function WhatsAppApp() {
  const [mock] = useState(() =>
    whatsappMockEnabled(whatsappMockFromSearch(window.location.search)),
  )
  const [status, setStatus] = useState<WhatsappStatus | null>(null)
  const [chats, setChats] = useState<WhatsappChat[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [exported, setExported] = useState<WhatsappExportResult | null>(null)
  const [phone, setPhone] = useState('')
  const [pairingCode, setPairingCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    document.title = 'wify · וואטסאפ'
  }, [])

  async function refresh() {
    const next = await fetchWhatsappStatus({ mock })
    setStatus(next)
    if (next.state === 'connected') {
      setChats(await fetchWhatsappChats({ mock }))
    }
    setError(null)
    return next
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    refresh()
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || 'load failed')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    const timer = window.setInterval(() => {
      if (mock) return
      void refresh().catch(() => {})
    }, 2000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [mock])

  async function onConnect() {
    setBusy(true)
    setError(null)
    try {
      await postWhatsappConnect({ mock })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'connect failed')
    } finally {
      setBusy(false)
    }
  }

  async function onPair() {
    setBusy(true)
    setError(null)
    try {
      const result = await postWhatsappPairingCode(phone, { mock })
      setPairingCode(result.pairingCode)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'pairing failed')
    } finally {
      setBusy(false)
    }
  }

  async function onExport() {
    setExporting(true)
    setError(null)
    try {
      const result = await postWhatsappExport({ mock })
      setExported(result)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'export failed')
    } finally {
      setExporting(false)
    }
  }

  const connected = status?.state === 'connected'
  const qr = status?.qr && status.qr.startsWith('data:') ? status.qr : null

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 pt-16">
      {loading ? (
        <p className="text-sm text-white/50">טוען מ־localhost:8789…</p>
      ) : null}
      {error ? (
        <p className="max-w-xl text-center text-sm text-rose-300">
          {error}
          <span className="mt-1 block text-xs text-white/40">
            whatsapp-loop על 127.0.0.1:8789 · או פתחו /whatsapp?mock=1
          </span>
        </p>
      ) : null}

      <article
        dir="rtl"
        className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#121214] shadow-2xl shadow-black/40"
      >
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-white/45">
              וואטסאפ · ingest · local
            </p>
            <h1 className="mt-0.5 text-base font-semibold text-white">
              ייצוא התכתבויות
            </h1>
          </div>
          <span className="rounded-full bg-white/8 px-2.5 py-1 text-xs font-medium text-white/70">
            {status ? statusLabel(status.state) : '—'}
          </span>
        </header>

        <div className="space-y-4 px-5 py-4">
          <p className="text-sm leading-relaxed text-white/70">
            קישור למכשיר כ־WhatsApp Web מקומי. בלי שליחה. הייצוא נשמר רק אצלך
            תחת data/whatsapp/export.
          </p>

          {status?.me ? (
            <p className="text-xs text-white/45" dir="ltr">
              {status.me.name} · {status.me.id}
            </p>
          ) : null}

          {qr ? (
            <section className="flex flex-col items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-4">
              <QrCode className="size-4 text-white/40" aria-hidden />
              <img
                src={qr}
                alt="קוד QR לקישור וואטסאפ"
                className="size-56 rounded-lg bg-white"
              />
              <p className="text-xs text-white/50">
                וואטסאפ → מכשירים מקושרים → קישור מכשיר
              </p>
            </section>
          ) : null}

          {!connected && !mock ? (
            <section className="space-y-2">
              <label
                htmlFor="wa-phone"
                className="block text-xs font-medium text-white/45"
              >
                או קוד קישור לפי מספר
              </label>
              <div className="flex gap-2">
                <input
                  id="wa-phone"
                  dir="ltr"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9725..."
                  className="min-w-0 flex-1 rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus-visible:border-white/30"
                />
                <button
                  type="button"
                  disabled={busy || !phone.trim()}
                  onClick={() => void onPair()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-sm text-white hover:bg-white/[0.08] disabled:opacity-40"
                >
                  <Smartphone className="size-4" aria-hidden />
                  קוד
                </button>
              </div>
              {pairingCode || status?.pairingCode ? (
                <p className="text-center font-mono text-lg tracking-[0.3em] text-white">
                  {pairingCode || status?.pairingCode}
                </p>
              ) : null}
            </section>
          ) : null}

          {connected ? (
            <section>
              <h2 className="mb-2 text-xs font-medium text-white/45">
                שיחות ({chats.length})
              </h2>
              <ul className="max-h-56 space-y-1 overflow-auto rounded-xl border border-white/8 bg-white/[0.03] p-2">
                {chats.map((chat) => (
                  <li
                    key={chat.jid}
                    className="rounded-lg px-2.5 py-2 text-sm text-white/80"
                  >
                    <span className="font-medium text-white">{chat.name}</span>
                    <span className="mt-0.5 block text-[11px] text-white/35" dir="ltr">
                      {chat.isGroup ? 'group' : 'chat'} · {chat.jid}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {exported ? (
            <p className="text-xs text-emerald-300">
              יוצאו {exported.chats} שיחות · {exported.messages} הודעות · לא
              נשלח כלום
              <span className="mt-1 block text-white/40" dir="ltr">
                {exported.dir}
              </span>
            </p>
          ) : null}
        </div>

        <footer className="flex gap-2 border-t border-white/10 px-5 py-4">
          {!connected ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onConnect()}
              className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white hover:bg-white/[0.08] disabled:opacity-40"
            >
              התחבר
            </button>
          ) : (
            <button
              type="button"
              disabled={exporting}
              aria-label="ייצא התכתבויות"
              onClick={() => void onExport()}
              className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-40"
            >
              <Download className="size-4" aria-hidden />
              {exporting ? 'מייצא…' : 'ייצא התכתבויות'}
            </button>
          )}
        </footer>
      </article>

      {mock ? (
        <p className="text-xs text-white/30">מצב mock · בלי חיבור אמיתי לוואטסאפ</p>
      ) : null}
    </main>
  )
}
