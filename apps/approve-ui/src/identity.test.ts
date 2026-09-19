import { describe, expect, test } from 'vitest'
import {
  applyIdentityVerdict,
  buildLikeMeVerdict,
  buildNotLikeMeVerdict,
  fitTagLabel,
  identityActionsLocked,
  identityCaseFromSearch,
  identityLiveFitFromSearch,
  identityMockFromSearch,
  identityPath,
  identityRejectClick,
  liveFitDoneLabel,
  liveFitProgressLabel,
  mockIdentityCard,
  MOCK_IDENTITY_CARDS,
  normalizeIdentityCard,
  parseIdentityVerdictResponse,
  parseLiveFitStart,
  resolveIdentityBase,
  normalizeRejectReason,
  verdictCaseId,
} from './identity'

const pendingCard = {
  id: 'c1',
  prompt: 'משימה 1',
  draft: 'טיוטה 1',
  critic_score: 0.9,
  reject_reason: null,
  fit_tags: [] as string[],
  risk: 'reversible' as const,
  status: 'pending' as const,
}

describe('identity case query', () => {
  test('no case query uses Live Fit session mode', () => {
    expect(identityCaseFromSearch('')).toBeNull()
    expect(identityCaseFromSearch('?foo=1')).toBeNull()
    expect(identityLiveFitFromSearch('')).toBe(true)
    expect(identityLiveFitFromSearch('?mock=1')).toBe(true)
  })

  test('reads case from the query string as single-card mode', () => {
    expect(identityCaseFromSearch('?case=reject-before-ui')).toBe(
      'reject-before-ui',
    )
    expect(identityCaseFromSearch('?case=live-fit-3')).toBe('live-fit-3')
    expect(identityLiveFitFromSearch('?case=live-fit-3')).toBe(false)
    expect(identityLiveFitFromSearch('?mock=1&case=pass-like-me')).toBe(false)
  })

  test('mock flag is opt-in', () => {
    expect(identityMockFromSearch('')).toBe(false)
    expect(identityMockFromSearch('?case=pass-like-me')).toBe(false)
    expect(identityMockFromSearch('?mock=1')).toBe(true)
  })
})

describe('identityActionsLocked', () => {
  test('pending reversible card can be acted on', () => {
    expect(
      identityActionsLocked({ status: 'pending', risk: 'reversible' }),
    ).toBe(false)
  })

  test('critic-rejected card locks כמוני/לא כמוני', () => {
    expect(
      identityActionsLocked({ status: 'rejected', risk: 'reversible' }),
    ).toBe(true)
  })

  test('already approved card is locked', () => {
    expect(
      identityActionsLocked({ status: 'approved', risk: 'reversible' }),
    ).toBe(true)
  })

  test('irreversible risk is locked', () => {
    expect(
      identityActionsLocked({ status: 'pending', risk: 'irreversible' }),
    ).toBe(true)
  })
})

describe('verdict bodies (identity-loop contract)', () => {
  const card = {
    risk: 'reversible' as const,
  }

  test('like_me sends risk + status=approved from the card', () => {
    expect(buildLikeMeVerdict('pass-like-me', card)).toEqual({
      case: 'pass-like-me',
      risk: 'reversible',
      status: 'approved',
      verdict: 'like_me',
    })
  })

  test('not_like_me sends risk + status=rejected and a reject_reason', () => {
    expect(buildNotLikeMeVerdict('pass-like-me', card, '  לא בסגנון  ')).toEqual(
      {
        case: 'pass-like-me',
        risk: 'reversible',
        status: 'rejected',
        verdict: 'not_like_me',
        reject_reason: 'לא בסגנון',
      },
    )
  })

  test('empty reject_reason is rejected before POST (backend would 400)', () => {
    expect(() => buildNotLikeMeVerdict('pass-like-me', card, '   ')).toThrow(
      /reject_reason required/,
    )
    expect(normalizeRejectReason('\n\t  ')).toBe('')
  })

  test('forwards irreversible risk from the card instead of hardcoding', () => {
    expect(
      buildLikeMeVerdict('pass-like-me', { risk: 'irreversible' }).risk,
    ).toBe('irreversible')
  })
})

describe('mock fixtures', () => {
  test('pass-like-me matches the localhost card contract shape', () => {
    const card = MOCK_IDENTITY_CARDS['pass-like-me']
    expect(card).toMatchObject({
      prompt: expect.any(String),
      draft: expect.any(String),
      critic_score: 0.91,
      reject_reason: null,
      fit_tags: [],
      risk: 'reversible',
      status: 'pending',
    })
    expect(typeof card.id).toBe('string')
  })

  test('reject-before-ui exposes critic reason and fit tags, not pending actions', () => {
    const card = mockIdentityCard('reject-before-ui')
    expect(card.status).toBe('rejected')
    expect(card.reject_reason).toBeTruthy()
    expect(card.fit_tags).toEqual(['ai_tell', 'style_mismatch'])
    expect(identityActionsLocked(card)).toBe(true)
  })

  test('unknown mock case falls back to pass-like-me', () => {
    expect(mockIdentityCard('nope').id).toBe(
      MOCK_IDENTITY_CARDS['pass-like-me'].id,
    )
  })
})

describe('fit tags', () => {
  test('known tags get Hebrew labels without dumping JSON', () => {
    expect(fitTagLabel('ai_tell')).toBe('ניסוח מודל')
    expect(fitTagLabel('style_mismatch')).toBe('לא בסגנון')
  })
})

describe('normalizeIdentityCard', () => {
  test('missing fit_tags becomes an empty list', () => {
    const card = normalizeIdentityCard({
      prompt: 'משימה',
      draft: 'טיוטה',
      risk: 'reversible',
      status: 'pending',
    })
    expect(card.fit_tags).toEqual([])
    expect(card.reject_reason).toBeNull()
  })
})

describe('identityRejectClick', () => {
  test('first click opens the reason field instead of POSTing', () => {
    expect(identityRejectClick(false, '')).toBe('open')
    expect(identityRejectClick(false, 'לא בסגנון')).toBe('open')
  })

  test('second click with empty reason stays on the field', () => {
    expect(identityRejectClick(true, '   ')).toBe('need-reason')
  })

  test('second click with a reason is ready to POST', () => {
    expect(identityRejectClick(true, 'לא בסגנון')).toBe('submit')
  })
})

describe('identity API base (must not hit mail-loop egress)', () => {
  test('empty or missing env uses the /id-api Vite proxy to :8788', () => {
    expect(resolveIdentityBase(undefined)).toBe('/id-api')
    expect(resolveIdentityBase('')).toBe('/id-api')
    expect(
      identityPath(resolveIdentityBase(''), '/local/egress-destinations'),
    ).toBe('/id-api/local/egress-destinations')
  })

  test('explicit loop URL is used as-is', () => {
    expect(
      identityPath(
        resolveIdentityBase('http://127.0.0.1:8788'),
        '/local/identity/card',
      ),
    ).toBe('http://127.0.0.1:8788/local/identity/card')
  })

  test('Live Fit session routes stay on the identity-loop base', () => {
    const base = resolveIdentityBase('http://127.0.0.1:8788')
    expect(identityPath(base, '/local/identity/live-fit/start')).toBe(
      'http://127.0.0.1:8788/local/identity/live-fit/start',
    )
    expect(identityPath(base, '/local/identity/live-fit/card')).toBe(
      'http://127.0.0.1:8788/local/identity/live-fit/card',
    )
    expect(identityPath(base, '/local/identity/live-fit/status')).toBe(
      'http://127.0.0.1:8788/local/identity/live-fit/status',
    )
  })
})

describe('Live Fit start → verdict → next_card', () => {
  test('start payload yields the first card and its case id for verdicts', () => {
    const started = parseLiveFitStart({
      case: 'live-fit-1',
      card: pendingCard,
      live_fit: { round: 1, total: 8, done: false },
    })
    expect(started.caseId).toBe('live-fit-1')
    expect(started.card.prompt).toBe('משימה 1')
    expect(started.card.draft).toBe('טיוטה 1')
    expect(verdictCaseId(started.card, started.caseId)).toBe('live-fit-1')
    expect(liveFitProgressLabel(started.liveFit)).toBe('סיבוב 1/8')
  })

  test('start can nest the card and put case on the card', () => {
    const started = parseLiveFitStart({
      session: { id: 'sess-1' },
      card: { ...pendingCard, case: 'live-fit-2' },
    })
    expect(started.caseId).toBe('live-fit-2')
    expect(verdictCaseId(started.card, started.caseId)).toBe('live-fit-2')
  })

  test('verdict with next_card advances to that card', () => {
    const started = parseLiveFitStart({
      case: 'live-fit-1',
      card: pendingCard,
      live_fit: { round: 1, total: 8, done: false },
    })
    const result = parseIdentityVerdictResponse({
      next_card: {
        ...pendingCard,
        id: 'c2',
        case: 'live-fit-2',
        prompt: 'משימה 2',
        draft: 'טיוטה 2',
      },
      live_fit: { round: 2, total: 8, done: false },
    })
    const next = applyIdentityVerdict(
      { caseId: started.caseId, card: started.card, liveFit: started.liveFit },
      result,
    )
    expect(next.done).toBe(false)
    expect(next.card?.prompt).toBe('משימה 2')
    expect(next.caseId).toBe('live-fit-2')
    expect(verdictCaseId(next.card!, next.caseId)).toBe('live-fit-2')
    expect(liveFitProgressLabel(next.liveFit)).toBe('סיבוב 2/8')
  })

  test('verdict with live_fit.done shows completed state with count', () => {
    const current = {
      caseId: 'live-fit-8',
      card: pendingCard,
      liveFit: { round: 8, total: 8, done: false },
    }
    const result = parseIdentityVerdictResponse({
      live_fit: { done: true, count: 8 },
    })
    const next = applyIdentityVerdict(current, result)
    expect(next.done).toBe(true)
    expect(next.card).toBeNull()
    expect(liveFitDoneLabel(next.liveFit)).toContain('סיבוב הושלם')
    expect(liveFitDoneLabel(next.liveFit)).toContain('8')
  })

  test('single-card verdict without next_card or done stays on the card', () => {
    const current = { caseId: 'pass-like-me', card: pendingCard }
    const next = applyIdentityVerdict(
      current,
      parseIdentityVerdictResponse({ ok: true }),
    )
    expect(next.done).toBe(false)
    expect(next.card).toEqual(pendingCard)
    expect(next.caseId).toBe('pass-like-me')
  })

  test('critic-rejected next_card still locks actions', () => {
    const result = parseIdentityVerdictResponse({
      next_card: {
        ...pendingCard,
        status: 'rejected',
        reject_reason: 'ניסוח מודל',
        fit_tags: ['ai_tell'],
      },
    })
    expect(result.nextCard).toBeTruthy()
    expect(identityActionsLocked(result.nextCard!)).toBe(true)
  })

  test('progress label is omitted when round is not in the payload', () => {
    expect(liveFitProgressLabel(undefined)).toBeNull()
    expect(liveFitProgressLabel({ done: false })).toBeNull()
    expect(liveFitProgressLabel({ done: false, round: 3 })).toBe('סיבוב 3')
  })
})
