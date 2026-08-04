import { describe, expect, it } from 'vitest'
import { parseStartPageWindowLayout } from './start-page-layout'

describe('start-page window layout', () => {
  it('puts a newly introduced manager window first for an existing layout', () => {
    expect(parseStartPageWindowLayout({ wide: ['documents', 'events'] }).wide[0]).toBe('teamAvailability')
  })

  it('preserves a saved position after the new window is known', () => {
    expect(parseStartPageWindowLayout({ wide: ['events', 'teamAvailability', 'documents'] }).wide.slice(0, 3)).toEqual(['events', 'teamAvailability', 'documents'])
  })
})
