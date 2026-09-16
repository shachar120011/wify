import { describe, expect, test } from 'vitest'
import {
  buildLikeMeVerdict,
  buildNotLikeMeVerdict,
  fitTagLabel,
  identityActionsLocked,
  identityCaseFromSearch,
  identityMockFromSearch,
  identityPath,
  identityRejectClick,
  mockIdentityCard,
  MOCK_IDENTITY_CARDS,
  normalizeIdentityCard,
  normalizeRejectReason,
  resolveIdentityBase,
} from './identity'

describe('identity case query', () => {
  test('defaults to pass-like-me', () => {
    expect(identityCaseFromSearch('')).toBe('pass-like-me')
    expect(identityCaseFromSearch('?foo=1')).toBe('pass-like-me')
  })

  test('reads case from the query string', () => {
    expect(identityCaseFromSearch('?case=reject-before-ui')).toBe(
      'reject-before-ui',
    )
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
})
