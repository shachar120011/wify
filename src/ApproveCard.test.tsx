import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { ApproveCard } from './ApproveCard'
import type { ApprovePayload } from './types'

const base: ApprovePayload = {
  to: 'out@acme.com',
  subject: 'OUTBOUND SUBJECT',
  body: 'OUTBOUND BODY',
  draft: {
    subject: 'DRAFT SUBJECT',
    body: 'DRAFT BODY',
  },
  critic_score: 0.91,
  reject_reason: null,
  risk: 'reversible',
  status: 'pending',
}

test('shows draft subject/body and critic score', () => {
  render(<ApproveCard payload={base} />)
  expect(screen.getByText('DRAFT SUBJECT')).toBeTruthy()
  expect(screen.getByText('DRAFT BODY')).toBeTruthy()
  expect(screen.getByText(/Critic 0\.91/)).toBeTruthy()
})

test('מה יוצא החוצה uses to/subject/body, not draft', () => {
  render(<ApproveCard payload={base} />)
  const outbound = screen.getByRole('heading', { name: 'מה יוצא החוצה' }).closest('section')
  expect(outbound?.textContent).toContain('out@acme.com')
  expect(outbound?.textContent).toContain('OUTBOUND SUBJECT')
  expect(outbound?.textContent).toContain('OUTBOUND BODY')
  expect(outbound?.textContent).not.toContain('DRAFT SUBJECT')
  expect(outbound?.textContent).not.toContain('DRAFT BODY')
})

test('hides irreversible risk and does not render the card', () => {
  const { container } = render(
    <ApproveCard payload={{ ...base, risk: 'irreversible' }} />,
  )
  expect(container.innerHTML).toBe('')
  expect(screen.queryByText(/irreversible|סיכון|risk/i)).toBeNull()
})

test('does not display a risk label for reversible payloads', () => {
  render(<ApproveCard payload={base} />)
  expect(screen.queryByText(/reversible|irreversible/i)).toBeNull()
})

test('Approve calls onDecide with approved', async () => {
  const onDecide = vi.fn()
  const user = userEvent.setup()
  render(<ApproveCard payload={base} onDecide={onDecide} />)
  await user.click(screen.getByRole('button', { name: 'Approve' }))
  expect(onDecide).toHaveBeenCalledWith('approved')
})

test('Reject calls onDecide with rejected', async () => {
  const onDecide = vi.fn()
  const user = userEvent.setup()
  render(<ApproveCard payload={base} onDecide={onDecide} />)
  await user.click(screen.getByRole('button', { name: 'Reject' }))
  expect(onDecide).toHaveBeenCalledWith('rejected')
})

test('failed Approve keeps the card pending and shows an error', async () => {
  const onDecide = vi.fn().mockRejectedValue(new Error('approve 500'))
  const user = userEvent.setup()
  render(<ApproveCard payload={base} onDecide={onDecide} />)
  await user.click(screen.getByRole('button', { name: 'Approve' }))
  expect(screen.getByText('השליחה נכשלה')).toBeTruthy()
  expect(
    (screen.getByRole('button', { name: 'Approve' }) as HTMLButtonElement)
      .disabled,
  ).toBe(false)
})
