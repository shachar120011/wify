import type { IdentityCard, IdentityVerdict } from './identity'
import {
  IDENTITY_DEFAULT_CASE,
  identityPath,
  mockIdentityCard,
  normalizeIdentityCard,
  resolveIdentityBase,
} from './identity'

/** Same-origin Vite proxy → 127.0.0.1:8788. Override with VITE_IDENTITY_LOOP_BASE. */
const BASE = resolveIdentityBase(import.meta.env.VITE_IDENTITY_LOOP_BASE)

const ENV_MOCK = import.meta.env.VITE_IDENTITY_MOCK === '1'
const DOWN = 'אין חיבור ל־identity-loop על :8788'

export function identityMockEnabled(queryMock: boolean): boolean {
  return ENV_MOCK || queryMock
}

async function readJson(res: Response): Promise<unknown> {
  return res.json().catch(() => ({}))
}

async function identityFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  try {
    return await fetch(identityPath(BASE, path), init)
  } catch {
    throw new Error(DOWN)
  }
}

function assertOk(res: Response, route: string): void {
  if (res.ok) return
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    throw new Error(DOWN)
  }
  throw new Error(`${route} ${res.status}`)
}

export async function fetchIdentityCard(
  caseId = IDENTITY_DEFAULT_CASE,
  opts: { mock?: boolean } = {},
): Promise<IdentityCard> {
  if (identityMockEnabled(opts.mock === true)) {
    return mockIdentityCard(caseId)
  }
  const res = await identityFetch(
    `/local/identity/card?case=${encodeURIComponent(caseId)}`,
  )
  assertOk(res, 'identity/card')
  return normalizeIdentityCard(await res.json())
}

export async function postIdentityVerdict(
  body: IdentityVerdict,
  opts: { mock?: boolean } = {},
): Promise<unknown> {
  if (identityMockEnabled(opts.mock === true)) {
    return { ok: true, mock: true, ...body }
  }
  const res = await identityFetch('/local/identity/verdict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      throw new Error(DOWN)
    }
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
  const res = await identityFetch('/local/egress-destinations')
  assertOk(res, 'egress-destinations')
  const data: unknown = await res.json()
  return Array.isArray(data) ? data : []
}
