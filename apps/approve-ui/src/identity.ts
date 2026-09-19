import type { Risk, Status } from './types'

export type IdentityFitTag = 'ai_tell' | 'style_mismatch' | (string & {})

export type IdentityCard = {
  id: string
  case?: string
  prompt: string
  draft: string
  critic_score: number
  reject_reason: string | null
  fit_tags: IdentityFitTag[]
  risk: Risk
  status: Status
}

export type LiveFitInfo = {
  done: boolean
  round?: number
  total?: number
  count?: number
}

export type LiveFitStartResult = {
  card: IdentityCard
  caseId: string
  liveFit?: LiveFitInfo
}

export type IdentityVerdictResult = {
  nextCard: IdentityCard | null
  caseId?: string
  liveFit?: LiveFitInfo
}

export type IdentitySessionState = {
  caseId: string
  card: IdentityCard
  liveFit?: LiveFitInfo
}

export type LikeMeVerdict = {
  case: string
  risk: Risk
  status: 'approved'
  verdict: 'like_me'
}

export type NotLikeMeVerdict = {
  case: string
  risk: Risk
  status: 'rejected'
  verdict: 'not_like_me'
  reject_reason: string
}

export type IdentityVerdict = LikeMeVerdict | NotLikeMeVerdict

export const IDENTITY_DEFAULT_CASE = 'pass-like-me'

export const MOCK_IDENTITY_CARDS: Record<string, IdentityCard> = {
  'pass-like-me': {
    id: 'mock-pass-like-me',
    prompt: 'משימת כתיבה קצרה',
    draft: 'טקסט ה־Doer',
    critic_score: 0.91,
    reject_reason: null,
    fit_tags: [],
    risk: 'reversible',
    status: 'pending',
  },
  'reject-before-ui': {
    id: 'mock-reject-before-ui',
    prompt: 'משימת כתיבה קצרה',
    draft: 'As an AI, I would be happy to help with this request.',
    critic_score: 0.18,
    reject_reason: 'ניסוח מודל / לא בסגנון',
    fit_tags: ['ai_tell', 'style_mismatch'],
    risk: 'reversible',
    status: 'rejected',
  },
}

export function identityCaseFromSearch(search: string): string | null {
  const value = new URLSearchParams(search).get('case')
  return value ? value : null
}

export function identityLiveFitFromSearch(search: string): boolean {
  return identityCaseFromSearch(search) == null
}

export function identityMockFromSearch(search: string): boolean {
  return new URLSearchParams(search).get('mock') === '1'
}

export function identityActionsLocked(
  card: Pick<IdentityCard, 'status' | 'risk'>,
): boolean {
  return card.status !== 'pending' || card.risk !== 'reversible'
}

export function normalizeRejectReason(reason: string): string {
  return reason.trim()
}

export function buildLikeMeVerdict(
  caseId: string,
  card: Pick<IdentityCard, 'risk'>,
): LikeMeVerdict {
  return {
    case: caseId,
    risk: card.risk,
    status: 'approved',
    verdict: 'like_me',
  }
}

export function buildNotLikeMeVerdict(
  caseId: string,
  card: Pick<IdentityCard, 'risk'>,
  rejectReason: string,
): NotLikeMeVerdict {
  const reason = normalizeRejectReason(rejectReason)
  if (!reason) {
    throw new Error('reject_reason required')
  }
  return {
    case: caseId,
    risk: card.risk,
    status: 'rejected',
    verdict: 'not_like_me',
    reject_reason: reason,
  }
}

export function mockIdentityCard(caseId: string): IdentityCard {
  return MOCK_IDENTITY_CARDS[caseId] ?? MOCK_IDENTITY_CARDS[IDENTITY_DEFAULT_CASE]
}

export function normalizeIdentityCard(
  raw: Partial<IdentityCard> &
    Pick<IdentityCard, 'prompt' | 'draft' | 'risk' | 'status'>,
): IdentityCard {
  const caseId = typeof raw.case === 'string' && raw.case ? raw.case : undefined
  return {
    id: raw.id || caseId || '',
    case: caseId,
    prompt: raw.prompt,
    draft: raw.draft,
    critic_score: Number(raw.critic_score ?? 0),
    reject_reason: raw.reject_reason ?? null,
    fit_tags: Array.isArray(raw.fit_tags) ? raw.fit_tags : [],
    risk: raw.risk,
    status: raw.status,
  }
}

export function verdictCaseId(
  card: Pick<IdentityCard, 'id' | 'case'>,
  sessionCaseId: string,
): string {
  return card.case || sessionCaseId || card.id
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

function cardSource(raw: Record<string, unknown>): Record<string, unknown> {
  const nested = asRecord(raw.card)
  if (nested && (nested.prompt != null || nested.draft != null)) return nested
  const session = asRecord(raw.session)
  const sessionCard = session ? asRecord(session.card) : null
  if (sessionCard && (sessionCard.prompt != null || sessionCard.draft != null)) {
    return sessionCard
  }
  return raw
}

export function parseIdentityCardPayload(raw: unknown): {
  card: IdentityCard
  caseId: string
} {
  const record = asRecord(raw)
  if (!record) {
    throw new Error('identity card missing')
  }
  const source = cardSource(record)
  const card = normalizeIdentityCard(
    source as Partial<IdentityCard> &
      Pick<IdentityCard, 'prompt' | 'draft' | 'risk' | 'status'>,
  )
  const explicitCase =
    asString(record.case) ||
    asString(source.case) ||
    asString(record.case_id)
  if (!card.case && explicitCase) card.case = explicitCase
  return { card, caseId: explicitCase || card.id }
}

export function parseLiveFit(raw: unknown): LiveFitInfo | undefined {
  const record = asRecord(raw)
  if (!record) return undefined
  const liveFit = asRecord(record.live_fit) ?? asRecord(record.liveFit)
  const card = asRecord(record.card) ?? asRecord(record.next_card)
  const source = liveFit ?? record
  const done = source.done === true || source.complete === true
  const round =
    asFiniteNumber(source.round) ??
    asFiniteNumber(record.round) ??
    asFiniteNumber(card?.round)
  const total =
    asFiniteNumber(source.total) ??
    asFiniteNumber(source.of) ??
    asFiniteNumber(source.rounds) ??
    asFiniteNumber(record.total) ??
    asFiniteNumber(card?.total)
  const count =
    asFiniteNumber(source.count) ??
    asFiniteNumber(source.labeled) ??
    asFiniteNumber(source.n)
  if (!done && round == null && total == null && count == null) return undefined
  return { done, round, total, count }
}

export function parseLiveFitStart(raw: unknown): LiveFitStartResult {
  const parsed = parseIdentityCardPayload(raw)
  return {
    card: parsed.card,
    caseId: parsed.caseId,
    liveFit: parseLiveFit(raw),
  }
}

export function parseIdentityVerdictResponse(
  raw: unknown,
): IdentityVerdictResult {
  const record = asRecord(raw) ?? {}
  const nextRaw = record.next_card ?? record.nextCard
  if (nextRaw && typeof nextRaw === 'object') {
    const parsed = parseIdentityCardPayload(nextRaw)
    const envelopeCase = asString(record.case) || asString(record.case_id)
    if (envelopeCase && !parsed.card.case) parsed.card.case = envelopeCase
    return {
      nextCard: parsed.card,
      caseId: envelopeCase || parsed.card.case,
      liveFit: parseLiveFit(raw),
    }
  }
  return {
    nextCard: null,
    liveFit: parseLiveFit(raw),
  }
}

export function applyIdentityVerdict(
  current: IdentitySessionState,
  result: IdentityVerdictResult,
): {
  caseId: string
  card: IdentityCard | null
  liveFit?: LiveFitInfo
  done: boolean
} {
  const liveFit =
    current.liveFit || result.liveFit
      ? {
          ...current.liveFit,
          ...result.liveFit,
          done: result.liveFit?.done ?? current.liveFit?.done ?? false,
        }
      : undefined
  if (result.nextCard) {
    return {
      caseId: result.caseId || verdictCaseId(result.nextCard, current.caseId),
      card: result.nextCard,
      liveFit,
      done: false,
    }
  }
  if (result.liveFit?.done) {
    return {
      caseId: current.caseId,
      card: null,
      liveFit: { ...liveFit, done: true },
      done: true,
    }
  }
  return {
    caseId: current.caseId,
    card: current.card,
    liveFit,
    done: false,
  }
}

export function liveFitProgressLabel(
  liveFit?: LiveFitInfo | null,
): string | null {
  if (!liveFit || liveFit.round == null) return null
  if (liveFit.total != null) return `סיבוב ${liveFit.round}/${liveFit.total}`
  return `סיבוב ${liveFit.round}`
}

export function liveFitDoneLabel(liveFit?: LiveFitInfo | null): string {
  if (liveFit?.count != null) return `סיבוב הושלם · ${liveFit.count}`
  return 'סיבוב הושלם'
}

export const MOCK_LIVE_FIT_CASE_IDS = ['live-fit-1', 'live-fit-2'] as const

export function mockLiveFitCardAt(index: number): IdentityCard {
  const caseId =
    MOCK_LIVE_FIT_CASE_IDS[index] ?? MOCK_LIVE_FIT_CASE_IDS[0]
  const base = MOCK_IDENTITY_CARDS['pass-like-me']
  return {
    ...base,
    id: `mock-${caseId}`,
    case: caseId,
    prompt: index === 0 ? base.prompt : 'משימת כתיבה נוספת',
    draft: index === 0 ? base.draft : 'טיוטה נוספת',
  }
}

export function mockLiveFitStart(): LiveFitStartResult {
  const card = mockLiveFitCardAt(0)
  return {
    card,
    caseId: card.case ?? MOCK_LIVE_FIT_CASE_IDS[0],
    liveFit: {
      done: false,
      round: 1,
      total: MOCK_LIVE_FIT_CASE_IDS.length,
    },
  }
}

export function mockLiveFitVerdict(indexAfter: number): IdentityVerdictResult {
  const total = MOCK_LIVE_FIT_CASE_IDS.length
  if (indexAfter < total) {
    const card = mockLiveFitCardAt(indexAfter)
    return {
      nextCard: card,
      caseId: card.case,
      liveFit: { done: false, round: indexAfter + 1, total },
    }
  }
  return {
    nextCard: null,
    liveFit: { done: true, count: total },
  }
}

export const FIT_TAG_LABELS: Record<string, string> = {
  ai_tell: 'ניסוח מודל',
  style_mismatch: 'לא בסגנון',
}

export function fitTagLabel(tag: string): string {
  return FIT_TAG_LABELS[tag] ?? tag
}

export function resolveIdentityBase(envBase: string | undefined): string {
  return envBase || '/id-api'
}

export function identityPath(base: string, path: string): string {
  return `${base.replace(/\/$/, '')}${path}`
}

export type IdentityRejectClick = 'open' | 'need-reason' | 'submit'

export function identityRejectClick(
  rejectOpen: boolean,
  reason: string,
): IdentityRejectClick {
  if (!rejectOpen) return 'open'
  if (!normalizeRejectReason(reason)) return 'need-reason'
  return 'submit'
}
