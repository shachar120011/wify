export type WhatsappState = 'disconnected' | 'connecting' | 'qr' | 'connected' | 'logged_out' | 'error'

export type WhatsappMe = {
  id: string
  name: string
}

export type WhatsappStatus = {
  state: WhatsappState
  qr: string | null
  pairingCode: string | null
  me: WhatsappMe | null
  error: string | null
  mock: boolean
  send: boolean
  chats?: number
  messages?: number
}

export type WhatsappChat = {
  jid: string
  name: string
  isGroup: boolean
  lastTimestamp: string | null
}

export type WhatsappMessage = {
  id: string
  chatJid?: string
  fromMe: boolean
  sender: string
  timestamp: string | null
  type: string
  text: string
}

export type WhatsappExportResult = {
  ok: boolean
  dir: string
  chats: number
  messages: number
  sent: boolean
  egress: boolean
  mock: boolean
}

export const MOCK_STATUS: WhatsappStatus = {
  state: 'connected',
  qr: null,
  pairingCode: null,
  me: { id: '972500000000@s.whatsapp.net', name: 'wify-mock' },
  error: null,
  mock: true,
  send: false,
}

export const MOCK_CHATS: WhatsappChat[] = [
  {
    jid: '972501111111@s.whatsapp.net',
    name: 'דני',
    isGroup: false,
    lastTimestamp: '2026-09-18T09:02:00.000Z',
  },
  {
    jid: '1203630-group@g.us',
    name: 'צוות wify',
    isGroup: true,
    lastTimestamp: '2026-09-17T18:00:00.000Z',
  },
]

const STATUS_LABELS: Record<WhatsappState, string> = {
  disconnected: 'לא מחובר',
  connecting: 'מתחבר',
  qr: 'ממתין לסריקת QR',
  connected: 'מחובר',
  logged_out: 'נותק',
  error: 'שגיאה',
}

export function statusLabel(state: WhatsappState | string): string {
  return STATUS_LABELS[state as WhatsappState] ?? state
}

export function whatsappMockFromSearch(search: string): boolean {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  return params.get('mock') === '1'
}

export function resolveWhatsappBase(envBase: string | undefined): string {
  return envBase || '/wa-api'
}

export function whatsappPath(base: string, path: string): string {
  return `${base.replace(/\/$/, '')}${path}`
}
