import type { ApprovePayload } from './types'

/** Empty in `npm run dev` so Vite can proxy /local to 127.0.0.1:8787. */
const BASE = import.meta.env.VITE_MAIL_LOOP_BASE ?? ''

export async function fetchApproveCard(
  caseId = 'pass-to-card',
): Promise<ApprovePayload> {
  const res = await fetch(
    `${BASE}/local/approve-card?case=${encodeURIComponent(caseId)}`,
  )
  if (!res.ok) throw new Error(`approve-card ${res.status}`)
  return res.json()
}

export async function postApprove(caseId = 'pass-to-card'): Promise<unknown> {
  const res = await fetch(`${BASE}/local/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      case: caseId,
      risk: 'reversible',
      status: 'approved',
    }),
  })
  if (!res.ok) throw new Error(`approve ${res.status}`)
  return res.json().catch(() => ({}))
}

export async function postReject(caseId = 'pass-to-card'): Promise<unknown> {
  const res = await fetch(`${BASE}/local/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ case: caseId }),
  })
  if (!res.ok) throw new Error(`reject ${res.status}`)
  return res.json().catch(() => ({}))
}
