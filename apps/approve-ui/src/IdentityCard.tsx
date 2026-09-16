import { Check, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  fitTagLabel,
  identityActionsLocked,
  identityRejectClick,
  type IdentityCard as IdentityCardPayload,
} from './identity'

type Props = {
  payload: IdentityCardPayload
  egressEmpty: boolean
  onLikeMe: () => void | Promise<void>
  onNotLikeMe: (rejectReason: string) => void | Promise<void>
}

function scoreTone(score: number) {
  if (score >= 0.9) return 'text-emerald-400 bg-emerald-400/10'
  if (score >= 0.75) return 'text-amber-300 bg-amber-300/10'
  return 'text-rose-300 bg-rose-300/10'
}

export function IdentityCard({
  payload,
  egressEmpty,
  onLikeMe,
  onNotLikeMe,
}: Props) {
  const [status, setStatus] = useState(payload.status)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [reasonHint, setReasonHint] = useState(false)
  const reasonRef = useRef<HTMLTextAreaElement>(null)
  const inflight = useRef(false)
  const criticLocked = identityActionsLocked(payload)
  const locked =
    criticLocked || status !== 'pending' || busy || inflight.current
  const reasonReady = rejectReason.trim().length > 0
  const showRejectField = rejectOpen && !locked

  useEffect(() => {
    if (showRejectField) reasonRef.current?.focus()
  }, [showRejectField])

  async function likeMe() {
    if (status !== 'pending' || criticLocked || inflight.current) return
    inflight.current = true
    setBusy(true)
    setActionError(null)
    setRejectOpen(false)
    try {
      await onLikeMe()
      setStatus('approved')
    } catch (err) {
      inflight.current = false
      setBusy(false)
      setActionError(err instanceof Error ? err.message : 'הפעולה נכשלה')
      return
    }
    setBusy(false)
  }

  async function notLikeMe() {
    if (status !== 'pending' || criticLocked || inflight.current) return
    const next = identityRejectClick(true, rejectReason)
    if (next !== 'submit') {
      setRejectOpen(true)
      setReasonHint(true)
      return
    }
    inflight.current = true
    setBusy(true)
    setActionError(null)
    setReasonHint(false)
    try {
      await onNotLikeMe(rejectReason)
      setStatus('rejected')
    } catch (err) {
      inflight.current = false
      setBusy(false)
      setActionError(err instanceof Error ? err.message : 'הפעולה נכשלה')
      return
    }
    setBusy(false)
    setRejectOpen(false)
  }

  return (
    <article
      dir="rtl"
      className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#121214] shadow-2xl shadow-black/40"
    >
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div>
          <p className="text-xs font-medium tracking-wide text-white/45">
            זהות · HITL · live
          </p>
          <h1 className="mt-0.5 text-base font-semibold text-white">
            האם זה כמוני?
          </h1>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium tabular-nums ${scoreTone(payload.critic_score)}`}
        >
          Critic {payload.critic_score.toFixed(2)}
        </span>
      </header>

      <div className="space-y-4 px-5 py-4">
        <section>
          <h2 className="mb-2 text-xs font-medium text-white/45">משימה</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-white">
            {payload.prompt}
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xs font-medium text-white/45">טיוטה</h2>
          <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-3">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/80">
              {payload.draft}
            </p>
          </div>
        </section>

        {payload.reject_reason ? (
          <section>
            <h2 className="mb-2 text-xs font-medium text-white/45">
              סיבת דחייה
            </h2>
            <p className="text-sm text-rose-300">{payload.reject_reason}</p>
          </section>
        ) : null}

        {payload.fit_tags.length > 0 ? (
          <section>
            <h2 className="mb-2 text-xs font-medium text-white/45">התאמה</h2>
            <ul className="flex flex-wrap gap-1.5">
              {payload.fit_tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/70"
                >
                  {fitTagLabel(tag)}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {egressEmpty ? (
          <p className="text-xs text-white/35">אין יעד יוצא</p>
        ) : null}

        {actionError ? (
          <p className="text-xs text-rose-300" dir="ltr">
            {actionError}
          </p>
        ) : null}

        {showRejectField ? (
          <section>
            <label
              htmlFor="identity-reject-reason"
              className="mb-2 block text-xs font-medium text-white/45"
            >
              סיבה אחת חובה
            </label>
            <textarea
              ref={reasonRef}
              id="identity-reject-reason"
              dir="rtl"
              rows={3}
              value={rejectReason}
              onChange={(e) => {
                setRejectReason(e.target.value)
                if (e.target.value.trim()) setReasonHint(false)
              }}
              placeholder="למה זה לא כמוני?"
              className="w-full resize-none rounded-xl border border-white/12 bg-white/[0.03] px-3.5 py-3 text-sm leading-relaxed text-white outline-none placeholder:text-white/30 focus-visible:border-white/30"
            />
            {reasonHint && !reasonReady ? (
              <p className="mt-2 text-xs text-rose-300">נדרשת סיבה אחת</p>
            ) : null}
          </section>
        ) : null}
      </div>

      <footer className="flex gap-2 border-t border-white/10 px-5 py-4">
        <button
          type="button"
          disabled={locked}
          aria-label="לא כמוני"
          aria-expanded={showRejectField}
          onClick={() => {
            if (status !== 'pending' || criticLocked || inflight.current) return
            const next = identityRejectClick(rejectOpen, rejectReason)
            if (next === 'open') {
              setRejectOpen(true)
              setActionError(null)
              return
            }
            if (next === 'need-reason') {
              setRejectOpen(true)
              setReasonHint(true)
              return
            }
            void notLikeMe()
          }}
          className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white transition duration-200 hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <X className="size-4" aria-hidden />
          {showRejectField ? 'שלח לא כמוני' : 'לא כמוני'}
        </button>
        <button
          type="button"
          disabled={locked}
          aria-label="כמוני"
          onClick={() => void likeMe()}
          className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition duration-200 hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Check className="size-4" aria-hidden />
          כמוני
        </button>
      </footer>

      {status !== 'pending' && !criticLocked ? (
        <p className="border-t border-white/10 px-5 py-3 text-center text-xs text-white/50">
          {status === 'approved' ? 'נשמר כ־כמוני' : 'נשמר כ־לא כמוני'}
        </p>
      ) : null}

      {criticLocked && payload.status === 'rejected' ? (
        <p className="border-t border-white/10 px-5 py-3 text-center text-xs text-white/40">
          נדחה על ידי המבקר
        </p>
      ) : null}
    </article>
  )
}
