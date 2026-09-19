import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  fetchIdentityCard,
  postIdentityVerdict,
  resetIdentityMockSession,
  startLiveFit,
} from './identityApi'
import { applyIdentityVerdict, buildLikeMeVerdict } from './identity'

const pending = {
  id: 'c1',
  prompt: 'משימה 1',
  draft: 'טיוטה 1',
  critic_score: 0.9,
  reject_reason: null,
  fit_tags: [],
  risk: 'reversible' as const,
  status: 'pending' as const,
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  resetIdentityMockSession()
})

describe('Live Fit API wiring', () => {
  test('start hits live-fit/start and returns the first card case id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        case: 'live-fit-1',
        card: pending,
        live_fit: { round: 1, total: 8, done: false },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const started = await startLiveFit()

    expect(fetchMock).toHaveBeenCalled()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit | undefined]
    expect(url).toContain('/local/identity/live-fit/start')
    const method = init?.method ?? 'GET'
    expect(['GET', 'POST']).toContain(method)
    expect(started.caseId).toBe('live-fit-1')
    expect(started.card.prompt).toBe('משימה 1')
  })

  test('verdict POST returns next_card so the session can advance', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        next_card: { ...pending, id: 'c2', case: 'live-fit-2', prompt: 'משימה 2' },
        live_fit: { round: 2, total: 8, done: false },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await postIdentityVerdict(
      buildLikeMeVerdict('live-fit-1', pending),
    )

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/local/identity/verdict')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toMatchObject({
      case: 'live-fit-1',
      verdict: 'like_me',
      risk: 'reversible',
      status: 'approved',
    })
    expect(result.nextCard?.prompt).toBe('משימה 2')
    expect(result.nextCard?.case).toBe('live-fit-2')
    expect(result.liveFit?.done).toBe(false)

    const next = applyIdentityVerdict(
      { caseId: 'live-fit-1', card: pending },
      result,
    )
    expect(next.caseId).toBe('live-fit-2')
    expect(next.card?.prompt).toBe('משימה 2')
  })

  test('?case= still loads a single card from /local/identity/card', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ ...pending, id: 'single' }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const card = await fetchIdentityCard('live-fit-3')

    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toContain('/local/identity/card')
    expect(url).toContain('case=live-fit-3')
    expect(url).not.toContain('live-fit/start')
    expect(card.id).toBe('single')
  })

  test('mock live-fit start then verdict yields next_card then done', async () => {
    const started = await startLiveFit({ mock: true })
    expect(started.caseId).toMatch(/^live-fit-/)
    expect(started.card.status).toBe('pending')

    const mid = await postIdentityVerdict(
      buildLikeMeVerdict(started.caseId, started.card),
      { mock: true },
    )
    const afterFirst = applyIdentityVerdict(
      { caseId: started.caseId, card: started.card, liveFit: started.liveFit },
      mid,
    )
    expect(afterFirst.done).toBe(false)
    expect(afterFirst.card).toBeTruthy()
    expect(afterFirst.caseId).not.toBe(started.caseId)

    const last = await postIdentityVerdict(
      buildLikeMeVerdict(afterFirst.caseId, afterFirst.card!),
      { mock: true },
    )
    const done = applyIdentityVerdict(
      {
        caseId: afterFirst.caseId,
        card: afterFirst.card!,
        liveFit: afterFirst.liveFit,
      },
      last,
    )
    expect(done.done).toBe(true)
    expect(done.card).toBeNull()
  })
})
