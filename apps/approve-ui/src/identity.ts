import type { Risk, Status } from './types'

export type IdentityFitTag = 'ai_tell' | 'style_mismatch' | (string & {})

export type IdentityCard = {
  id: string
  prompt: string
  draft: string
  critic_score: number
  reject_reason: string | null
  fit_tags: IdentityFitTag[]
  risk: Risk
  status: Status
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

export function identityCaseFromSearch(search: string): string {
  const params = new URLSearchParams(search)
  return params.get('case') || IDENTITY_DEFAULT_CASE
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
  return {
    id: raw.id ?? '',
    prompt: raw.prompt,
    draft: raw.draft,
    critic_score: Number(raw.critic_score ?? 0),
    reject_reason: raw.reject_reason ?? null,
    fit_tags: Array.isArray(raw.fit_tags) ? raw.fit_tags : [],
    risk: raw.risk,
    status: raw.status,
  }
}

export const FIT_TAG_LABELS: Record<string, string> = {
  ai_tell: 'ניסוח מודל',
  style_mismatch: 'לא בסגנון',
}

export function fitTagLabel(tag: string): string {
  return FIT_TAG_LABELS[tag] ?? tag
}
