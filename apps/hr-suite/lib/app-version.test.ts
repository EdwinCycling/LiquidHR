import { describe, expect, it } from 'vitest'
import { APP_VERSION } from './app-version'

describe('APP_VERSION', () => {
  it('volgt het formaat X.datum.volgnummer', () => {
    expect(APP_VERSION).toMatch(/^1\.\d{8}\.\d+$/)
  })

  it('start met de door de opdrachtgever gekozen hoofdversie', () => {
    expect(APP_VERSION).toBe('1.20260718.11')
  })
})
