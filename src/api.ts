import type { ApprovePayload } from './types'

const BASE = 'http://127.0.0.1:8787'

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
    body: JSON.stringify({ case: caseId }),
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
  // reject endpoint may not exist — soft-fail for Demo
  if (!res.ok && res.status !== 404) throw new Error(`reject ${res.status}`)
  return res.json().catch(() => ({}))
}
