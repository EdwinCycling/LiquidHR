import { describe, expect, it } from 'vitest'
import { APP_VERSION } from './app-version'

describe('APP_VERSION', () => {
  it('volgt het formaat hoofdversie.datum.volgnummer', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d{8}\.\d+$/)
  })

  it('start met de door de opdrachtgever gekozen hoofdversie', () => {
    expect(APP_VERSION.split('.')[0]).toBe('1')
  })
})
