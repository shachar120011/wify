import { useEffect, useState } from 'react'
import { IdentityCard } from './IdentityCard'
import {
  applyIdentityVerdict,
  buildLikeMeVerdict,
  buildNotLikeMeVerdict,
  identityCaseFromSearch,
  identityLiveFitFromSearch,
  identityMockFromSearch,
  liveFitDoneLabel,
  liveFitProgressLabel,
  type IdentityCard as IdentityCardPayload,
  type IdentityVerdictResult,
  type LiveFitInfo,
  verdictCaseId,
} from './identity'
import {
  fetchIdentityCard,
  fetchIdentityEgress,
  fetchLiveFitStatus,
  identityMockEnabled,
  postIdentityVerdict,
  startLiveFit,
} from './identityApi'

export function IdentityApp() {
  const search = window.location.search
  const [liveFitMode] = useState(() => identityLiveFitFromSearch(search))
  const [queryCase] = useState(() => identityCaseFromSearch(search) ?? '')
  const [caseId, setCaseId] = useState(queryCase)
  const [mock] = useState(() =>
    identityMockEnabled(identityMockFromSearch(search)),
  )
  const [payload, setPayload] = useState<IdentityCardPayload | null>(null)
  const [liveFit, setLiveFit] = useState<LiveFitInfo | undefined>()
  const [sessionDone, setSessionDone] = useState(false)
  const [egressEmpty, setEgressEmpty] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.title = 'wify · זהות'
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setSessionDone(false)
    const cardPromise = liveFitMode
      ? startLiveFit({ mock }).then((started) => {
          if (cancelled) return
          setCaseId(started.caseId)
          setLiveFit(started.liveFit)
          return started.card
        })
      : fetchIdentityCard(queryCase, { mock })
    const statusPromise = liveFitMode
      ? fetchLiveFitStatus({ mock }).catch(() => null)
      : Promise.resolve(null)

    Promise.all([
      cardPromise,
      fetchIdentityEgress({ mock }).catch(() => []),
      statusPromise,
    ])
      .then(([card, destinations, status]) => {
        if (cancelled) return
        setPayload(card ?? null)
        setEgressEmpty(destinations.length === 0)
        setError(null)
        if (status?.round != null) {
          setLiveFit((prev) => {
            if (prev?.round != null) return prev
            return {
              done: prev?.done ?? false,
              ...prev,
              round: status.round,
              total: prev?.total ?? status.total,
              count: prev?.count ?? status.count,
            }
          })
        }
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
  }, [liveFitMode, mock, queryCase])

  function advanceFromVerdict(result: IdentityVerdictResult) {
    if (!payload) return
    const next = applyIdentityVerdict(
      { caseId, card: payload, liveFit },
      result,
    )
    setLiveFit(next.liveFit)
    setCaseId(next.caseId)
    if (next.done) {
      setSessionDone(true)
      setPayload(null)
      return
    }
    if (next.card && next.card !== payload) {
      setPayload(next.card)
    }
  }

  async function onLikeMe(): Promise<IdentityVerdictResult> {
    if (!payload) return { nextCard: null }
    const result = await postIdentityVerdict(
      buildLikeMeVerdict(verdictCaseId(payload, caseId), payload),
      { mock },
    )
    advanceFromVerdict(result)
    return result
  }

  async function onNotLikeMe(
    rejectReason: string,
  ): Promise<IdentityVerdictResult> {
    if (!payload) return { nextCard: null }
    const result = await postIdentityVerdict(
      buildNotLikeMeVerdict(
        verdictCaseId(payload, caseId),
        payload,
        rejectReason,
      ),
      { mock },
    )
    advanceFromVerdict(result)
    return result
  }

  const progress = liveFitProgressLabel(liveFit)

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
      {sessionDone ? (
        <p className="text-sm text-white/70" dir="rtl">
          {liveFitDoneLabel(liveFit)}
        </p>
      ) : null}
      {payload ? (
        <IdentityCard
          key={`${caseId}:${payload.id}`}
          payload={payload}
          egressEmpty={egressEmpty}
          progress={progress}
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
