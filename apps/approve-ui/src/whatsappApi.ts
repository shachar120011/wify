import type { WhatsappChat, WhatsappExportResult, WhatsappStatus } from './whatsapp'
import {
  MOCK_CHATS,
  MOCK_STATUS,
  resolveWhatsappBase,
  whatsappMockFromSearch,
  whatsappPath,
} from './whatsapp'

const BASE = resolveWhatsappBase(import.meta.env.VITE_WHATSAPP_LOOP_BASE)
const ENV_MOCK = import.meta.env.VITE_WHATSAPP_MOCK === '1'
const DOWN = 'אין חיבור ל־whatsapp-loop על :8789'

export function whatsappMockEnabled(queryMock: boolean): boolean {
  return ENV_MOCK || queryMock
}

export { whatsappMockFromSearch }

async function waFetch(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(whatsappPath(BASE, path), init)
  } catch {
    throw new Error(DOWN)
  }
}

function assertOk(res: Response, route: string): void {
  if (res.ok) return
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    throw new Error(DOWN)
  }
  throw new Error(`${route} ${res.status}`)
}

export async function fetchWhatsappStatus(opts: {
  mock?: boolean
} = {}): Promise<WhatsappStatus> {
  if (whatsappMockEnabled(opts.mock === true)) return MOCK_STATUS
  const res = await waFetch('/local/whatsapp/status')
  assertOk(res, 'whatsapp/status')
  return res.json()
}

export async function fetchWhatsappChats(opts: {
  mock?: boolean
} = {}): Promise<WhatsappChat[]> {
  if (whatsappMockEnabled(opts.mock === true)) return MOCK_CHATS
  const res = await waFetch('/local/whatsapp/chats')
  assertOk(res, 'whatsapp/chats')
  const body = (await res.json()) as { chats?: WhatsappChat[] }
  return Array.isArray(body.chats) ? body.chats : []
}

export async function postWhatsappConnect(opts: {
  mock?: boolean
} = {}): Promise<WhatsappStatus> {
  if (whatsappMockEnabled(opts.mock === true)) return MOCK_STATUS
  const res = await waFetch('/local/whatsapp/connect', { method: 'POST' })
  assertOk(res, 'whatsapp/connect')
  return res.json()
}

export async function postWhatsappPairingCode(
  phone: string,
  opts: { mock?: boolean } = {},
): Promise<{ pairingCode: string }> {
  if (whatsappMockEnabled(opts.mock === true)) {
    throw new Error('מצב mock בלי קוד קישור')
  }
  const res = await waFetch('/local/whatsapp/pairing-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  })
  assertOk(res, 'whatsapp/pairing-code')
  return res.json()
}

export async function postWhatsappExport(opts: {
  mock?: boolean
} = {}): Promise<WhatsappExportResult> {
  if (whatsappMockEnabled(opts.mock === true)) {
    return {
      ok: true,
      dir: 'data/whatsapp/export/mock',
      chats: MOCK_CHATS.length,
      messages: 4,
      sent: false,
      egress: false,
      mock: true,
    }
  }
  const res = await waFetch('/local/whatsapp/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ format: 'both' }),
  })
  assertOk(res, 'whatsapp/export')
  return res.json()
}
