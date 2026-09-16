export type Risk = 'reversible' | 'irreversible'
export type Status = 'pending' | 'approved' | 'rejected'

export type ApprovePayload = {
  to: string
  subject: string
  body: string
  draft: { subject: string; body: string }
  critic_score: number
  reject_reason: string | null
  risk: Risk
  status: Status
}
