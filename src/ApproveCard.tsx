import { Check, ShieldAlert, X } from 'lucide-react'
import { useState } from 'react'
import type { ApprovePayload, Status } from './types'

type Props = {
  payload: ApprovePayload
  onDecide?: (
    status: Extract<Status, 'approved' | 'rejected'>,
  ) => void | Promise<void>
}

function scoreTone(score: number) {
  if (score >= 0.9) return 'text-emerald-400 bg-emerald-400/10'
  if (score >= 0.75) return 'text-amber-300 bg-amber-300/10'
  return 'text-rose-300 bg-rose-300/10'
}

export function ApproveCard({ payload, onDecide }: Props) {
  const [status, setStatus] = useState<Status>(payload.status)
  const [busy, setBusy] = useState(false)
  const locked = status !== 'pending' || busy

  // Hide irreversible cases; ignore risk otherwise (never render it).
  if (payload.risk === 'irreversible') return null

  async function decide(next: 'approved' | 'rejected') {
    if (locked) return
    setBusy(true)
    try {
      await onDecide?.(next)
      setStatus(next)
    } catch {
      setBusy(false)
      return
    }
    setBusy(false)
  }

  return (
    <article
      dir="rtl"
      className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#121214] shadow-2xl shadow-black/40"
    >
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div>
          <p className="text-xs font-medium tracking-wide text-white/45">
            טיוטת מייל · HITL · live
          </p>
          <h1 className="mt-0.5 text-base font-semibold text-white">
            אישור לפני שליחה
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
          <h2 className="mb-2 text-xs font-medium text-white/45">טיוטה</h2>
          <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-3">
            <p className="text-sm font-medium text-white" dir="auto">
              {payload.draft.subject}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/70" dir="auto">
              {payload.draft.body}
            </p>
          </div>
          {payload.reject_reason ? (
            <p className="mt-2 text-xs text-rose-300">{payload.reject_reason}</p>
          ) : null}
        </section>

        <section className="rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-3.5 py-3">
          <div className="mb-2 flex items-center gap-1.5 text-amber-200">
            <ShieldAlert className="size-3.5 shrink-0" aria-hidden />
            <h2 className="text-xs font-semibold tracking-wide">
              מה יוצא החוצה
            </h2>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="w-12 shrink-0 text-white/40">אל</dt>
              <dd className="min-w-0 break-all text-white" dir="ltr">
                {payload.to}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-12 shrink-0 text-white/40">נושא</dt>
              <dd className="min-w-0 text-white" dir="auto">{payload.subject}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-12 shrink-0 text-white/40">גוף</dt>
              <dd className="min-w-0 whitespace-pre-wrap leading-relaxed text-white/80" dir="auto">
                {payload.body}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <footer className="flex gap-2 border-t border-white/10 px-5 py-4">
        <button
          type="button"
          disabled={locked}
          onClick={() => void decide('rejected')}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <X className="size-4" aria-hidden />
          Reject
        </button>
        <button
          type="button"
          disabled={locked}
          onClick={() => void decide('approved')}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Check className="size-4" aria-hidden />
          Approve
        </button>
      </footer>

      {status !== 'pending' ? (
        <p className="border-t border-white/10 px-5 py-3 text-center text-xs text-white/50">
          {status === 'approved'
            ? 'אושר — POST /local/approve נשלח'
            : 'נדחה — לא נשלח'}
        </p>
      ) : null}
    </article>
  )
}
