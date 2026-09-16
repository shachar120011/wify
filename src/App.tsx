import { useEffect, useState } from 'react'
import { ApproveCard } from './ApproveCard'
import { fetchApproveCard, postApprove, postReject } from './api'
import type { ApprovePayload, Status } from './types'

const CASE_ID = 'pass-to-card'

export default function App() {
  const [payload, setPayload] = useState<ApprovePayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchApproveCard(CASE_ID)
      .then((data) => {
        if (!cancelled) setPayload(data)
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
  }, [])

  async function onDecide(status: Extract<Status, 'approved' | 'rejected'>) {
    if (status === 'approved') await postApprove(CASE_ID)
    else await postReject(CASE_ID)
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-3 p-6">
      {loading ? (
        <p className="text-sm text-white/50">טוען מ־localhost:8787…</p>
      ) : null}
      {error ? (
        <p className="text-sm text-rose-300" dir="ltr">
          {error}
        </p>
      ) : null}
      {payload ? <ApproveCard payload={payload} onDecide={onDecide} /> : null}
    </main>
  )
}
