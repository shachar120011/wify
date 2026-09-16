import { useEffect, useState } from 'react'
import { ApproveCard } from './ApproveCard'
import { fetchApproveCard, postApprove, postReject } from './api'
import type { ApprovePayload, Status } from './types'

function caseFromQuery() {
  const params = new URLSearchParams(window.location.search)
  return params.get('case') || 'pass-to-card'
}

export function MailApp() {
  const [caseId] = useState(caseFromQuery)
  const [payload, setPayload] = useState<ApprovePayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.title = 'wify · אישור לפני שליחה'
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchApproveCard(caseId)
      .then((data) => {
        if (!cancelled) {
          setPayload(data)
          setError(null)
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
  }, [caseId])

  async function onDecide(status: Extract<Status, 'approved' | 'rejected'>) {
    if (status === 'approved') await postApprove(caseId)
    else await postReject(caseId)
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 pt-16">
      {loading ? (
        <p className="text-sm text-white/50">טוען מ־localhost:8787…</p>
      ) : null}
      {error ? (
        <p className="text-sm text-rose-300" dir="ltr">
          {error} - start: node services/mail-loop/server.mjs
        </p>
      ) : null}
      {payload ? <ApproveCard payload={payload} onDecide={onDecide} /> : null}
      <p className="text-xs text-white/35" dir="ltr">
        case={caseId}
      </p>
    </div>
  )
}
