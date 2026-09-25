import { describe, expect, it } from 'vitest'
import { parseStartPageWindowLayout } from './start-page-layout'

describe('start-page window layout', () => {
  it('keeps the full-width team availability window outside personal window ordering', () => {
    expect(parseStartPageWindowLayout({ wide: ['teamAvailability', 'events', 'documents'] }).wide).toEqual([
      'events', 'documents', 'continuousAppraisal', 'leave', 'absenceCases', 'kpis',
    ])
  })

  it('preserves a saved position for the remaining wide windows', () => {
    expect(parseStartPageWindowLayout({ wide: ['events', 'documents'] }).wide.slice(0, 2)).toEqual(['events', 'documents'])
  })
})
