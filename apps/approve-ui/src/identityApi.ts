import type {
  IdentityCard,
  IdentityVerdict,
  IdentityVerdictResult,
  LiveFitStartResult,
  LiveFitInfo,
} from './identity'
import {
  IDENTITY_DEFAULT_CASE,
  identityPath,
  mockIdentityCard,
  mockLiveFitStart,
  mockLiveFitVerdict,
  normalizeIdentityCard,
  parseIdentityVerdictResponse,
  parseLiveFit,
  parseLiveFitStart,
  resolveIdentityBase,
} from './identity'

/** Same-origin Vite proxy → 127.0.0.1:8788. Override with VITE_IDENTITY_LOOP_BASE. */
const BASE = resolveIdentityBase(import.meta.env?.VITE_IDENTITY_LOOP_BASE)

const ENV_MOCK = import.meta.env?.VITE_IDENTITY_MOCK === '1'
const DOWN = 'אין חיבור ל־identity-loop על :8788'

let mockLiveFitIndex = 0
let mockLiveFitActive = false

export function resetIdentityMockSession(): void {
  mockLiveFitIndex = 0
  mockLiveFitActive = false
}

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

/** Backend accepts GET or POST; POST starts a fresh session. */
export async function startLiveFit(
  opts: { mock?: boolean } = {},
): Promise<LiveFitStartResult> {
  if (identityMockEnabled(opts.mock === true)) {
    mockLiveFitActive = true
    mockLiveFitIndex = 0
    return mockLiveFitStart()
  }
  let res = await identityFetch('/local/identity/live-fit/start', {
    method: 'POST',
  })
  if (res.status === 404 || res.status === 405) {
    res = await identityFetch('/local/identity/live-fit/start')
  }
  assertOk(res, 'identity/live-fit/start')
  return parseLiveFitStart(await res.json())
}

export async function fetchLiveFitStatus(
  opts: { mock?: boolean } = {},
): Promise<LiveFitInfo & { ready_for_demo?: boolean }> {
  if (identityMockEnabled(opts.mock === true)) {
    return { ready_for_demo: true, done: false }
  }
  const res = await identityFetch('/local/identity/live-fit/status')
  assertOk(res, 'identity/live-fit/status')
  const raw: unknown = await res.json()
  const record =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}
  const liveFit = parseLiveFit(raw)
  return {
    ready_for_demo: record.ready_for_demo === true,
    done: liveFit?.done ?? false,
    round: liveFit?.round,
    total: liveFit?.total,
    count: liveFit?.count,
  }
}

export async function postIdentityVerdict(
  body: IdentityVerdict,
  opts: { mock?: boolean } = {},
): Promise<IdentityVerdictResult> {
  if (identityMockEnabled(opts.mock === true)) {
    if (mockLiveFitActive) {
      mockLiveFitIndex += 1
      const result = mockLiveFitVerdict(mockLiveFitIndex)
      if (result.liveFit?.done) mockLiveFitActive = false
      return result
    }
    return { nextCard: null }
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
  return parseIdentityVerdictResponse(await readJson(res))
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
