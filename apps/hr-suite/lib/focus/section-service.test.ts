import { describe, expect, it } from 'vitest'
import { isFocusAbsenceCaseVisible } from './section-service'

describe('Focus absence state visibility', () => {
  it('does not block a new self-report after the recovery window ended', () => {
    expect(isFocusAbsenceCaseVisible({ status: 'RECOVERY_WINDOW', recovery_window_ends_on: '2026-09-18' }, '2026-09-20')).toBe(false)
  })

  it('keeps an active case visible and preserves an open recovery window', () => {
    expect(isFocusAbsenceCaseVisible({ status: 'ACTIVE', recovery_window_ends_on: null }, '2026-09-20')).toBe(true)
    expect(isFocusAbsenceCaseVisible({ status: 'RECOVERY_WINDOW', recovery_window_ends_on: '2026-09-21' }, '2026-09-20')).toBe(true)
  })
})
