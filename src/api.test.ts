import { afterEach, expect, test, vi } from 'vitest'
import { fetchApproveCard, postApprove } from './api'

const ok = (body: unknown = {}) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: async () => body,
  }) as Promise<Response>

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('fetchApproveCard loads pass-to-card from the local loop', async () => {
  const fetchMock = vi.fn().mockImplementation(() => ok({}))
  vi.stubGlobal('fetch', fetchMock)
  await fetchApproveCard()
  expect(fetchMock).toHaveBeenCalledWith(
    'http://127.0.0.1:8787/local/approve-card?case=pass-to-card',
  )
})

test('postApprove POSTs case pass-to-card', async () => {
  const fetchMock = vi.fn().mockImplementation(() => ok({}))
  vi.stubGlobal('fetch', fetchMock)
  await postApprove()
  expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8787/local/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ case: 'pass-to-card' }),
  })
})
