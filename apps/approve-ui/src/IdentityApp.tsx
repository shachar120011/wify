import { useEffect, useState } from 'react'
import { IdentityCard } from './IdentityCard'
import {
  buildLikeMeVerdict,
  buildNotLikeMeVerdict,
  identityCaseFromSearch,
  identityMockFromSearch,
  type IdentityCard as IdentityCardPayload,
} from './identity'
import {
  fetchIdentityCard,
  fetchIdentityEgress,
  identityMockEnabled,
  postIdentityVerdict,
} from './identityApi'

export function IdentityApp() {
  const search = window.location.search
  const [caseId] = useState(() => identityCaseFromSearch(search))
  const [mock] = useState(() => identityMockEnabled(identityMockFromSearch(search)))
  const [payload, setPayload] = useState<IdentityCardPayload | null>(null)
  const [egressEmpty, setEgressEmpty] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.title = 'wify · זהות'
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchIdentityCard(caseId, { mock }),
      fetchIdentityEgress({ mock }).catch(() => []),
    ])
      .then(([card, destinations]) => {
        if (cancelled) return
        setPayload(card)
        setEgressEmpty(destinations.length === 0)
        setError(null)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || 'load failed')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [caseId, mock])

  async function onLikeMe() {
    if (!payload) return
    await postIdentityVerdict(buildLikeMeVerdict(caseId, payload), { mock })
  }

  async function onNotLikeMe(rejectReason: string) {
    if (!payload) return
    await postIdentityVerdict(
      buildNotLikeMeVerdict(caseId, payload, rejectReason),
      { mock },
    )
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 pt-16">
      {loading ? (
        <p className="text-sm text-white/50">טוען מ־localhost:8788…</p>
      ) : null}
      {error ? (
        <p className="max-w-xl text-center text-sm text-rose-300">
          {error}
          <span className="mt-1 block text-xs text-white/40">
            identity-loop על 127.0.0.1:8788 · או פתחו /identity?mock=1
          </span>
        </p>
      ) : null}
      {payload ? (
        <IdentityCard
          payload={payload}
          egressEmpty={egressEmpty}
          onLikeMe={onLikeMe}
          onNotLikeMe={onNotLikeMe}
        />
      ) : null}
      {mock ? (
        <p className="text-xs text-white/30">מצב mock · בלי identity-loop</p>
      ) : null}
    </main>
  )
}
