import type { ApprovePayload } from './types'

/** Local mock from בקה — outbound fields come from API only */
export const mockPending: ApprovePayload = {
  to: 'alex@acme.com',
  subject: 'Re: kickoff tomorrow',
  body: "Thanks — I'll join at 10:00 and bring the updated scope notes.\n\nBest,\nShachar",
  draft: {
    subject: 'Re: kickoff tomorrow',
    body: "Thanks — I'll join at 10:00 and bring the updated scope notes.\n\nBest,\nShachar",
  },
  critic_score: 0.91,
  reject_reason: null,
  risk: 'reversible',
  status: 'pending',
}
