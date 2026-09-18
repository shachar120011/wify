import { describe, expect, test } from 'vitest'
import {
  resolveWhatsappBase,
  statusLabel,
  whatsappMockFromSearch,
  whatsappPath,
} from './whatsapp'

describe('whatsapp query helpers', () => {
  test('mock flag is opt-in', () => {
    expect(whatsappMockFromSearch('')).toBe(false)
    expect(whatsappMockFromSearch('?case=x')).toBe(false)
    expect(whatsappMockFromSearch('?mock=1')).toBe(true)
  })

  test('empty base uses vite /wa-api proxy', () => {
    expect(resolveWhatsappBase(undefined)).toBe('/wa-api')
    expect(resolveWhatsappBase('')).toBe('/wa-api')
    expect(resolveWhatsappBase('http://127.0.0.1:8789')).toBe(
      'http://127.0.0.1:8789',
    )
  })

  test('whatsappPath prefixes the base', () => {
    expect(whatsappPath('/wa-api', '/local/whatsapp/status')).toBe(
      '/wa-api/local/whatsapp/status',
    )
  })
})

describe('statusLabel', () => {
  test('maps connection states to hebrew', () => {
    expect(statusLabel('disconnected')).toBe('לא מחובר')
    expect(statusLabel('qr')).toBe('ממתין לסריקת QR')
    expect(statusLabel('connected')).toBe('מחובר')
    expect(statusLabel('connecting')).toBe('מתחבר')
  })
})
