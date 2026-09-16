import { describe, expect, test } from 'vitest'
import { modeFromPath } from './ModeNav'

describe('modeFromPath', () => {
  test('mail is the default route', () => {
    expect(modeFromPath('/')).toBe('mail')
    expect(modeFromPath('/?case=pass-to-card')).toBe('mail')
  })

  test('identity lives at /identity', () => {
    expect(modeFromPath('/identity')).toBe('identity')
    expect(modeFromPath('/identity/')).toBe('identity')
  })
})
