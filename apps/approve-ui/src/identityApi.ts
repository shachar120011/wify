import type { IdentityCard, IdentityVerdict } from './identity'
import {
  IDENTITY_DEFAULT_CASE,
  mockIdentityCard,
  normalizeIdentityCard,
} from './identity'

/** Same-origin Vite proxy → 127.0.0.1:8788. Override with VITE_IDENTITY_LOOP_BASE. */
const BASE = import.meta.env.VITE_IDENTITY_LOOP_BASE ?? '/id-api'

const ENV_MOCK = import.meta.env.VITE_IDENTITY_MOCK === '1'

export function identityMockEnabled(queryMock: boolean): boolean {
  return ENV_MOCK || queryMock
}

async function readJson(res: Response): Promise<unknown> {
  return res.json().catch(() => ({}))
}

export async function fetchIdentityCard(
  caseId = IDENTITY_DEFAULT_CASE,
  opts: { mock?: boolean } = {},
): Promise<IdentityCard> {
  if (identityMockEnabled(opts.mock === true)) {
    return mockIdentityCard(caseId)
  }
  const res = await fetch(
    `${BASE}/local/identity/card?case=${encodeURIComponent(caseId)}`,
  )
  if (!res.ok) throw new Error(`identity/card ${res.status}`)
  return normalizeIdentityCard(await res.json())
}

export async function postIdentityVerdict(
  body: IdentityVerdict,
  opts: { mock?: boolean } = {},
): Promise<unknown> {
  if (identityMockEnabled(opts.mock === true)) {
    return { ok: true, mock: true, ...body }
  }
  const res = await fetch(`${BASE}/local/identity/verdict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const payload = (await readJson(res)) as { error?: string }
    const detail = payload.error ? ` ${payload.error}` : ''
    throw new Error(`identity/verdict ${res.status}${detail}`)
  }
  return readJson(res)
}

export async function fetchIdentityEgress(
  opts: { mock?: boolean } = {},
): Promise<unknown[]> {
  if (identityMockEnabled(opts.mock === true)) {
    return []
  }
  const res = await fetch(`${BASE}/local/egress-destinations`)
  if (!res.ok) throw new Error(`egress-destinations ${res.status}`)
  const data: unknown = await res.json()
  return Array.isArray(data) ? data : []
}
