import { describe, expect, it } from 'vitest'
import { moveWidget } from './dashboard-workspace-model'

describe('moveWidget', () => {
  it('verplaatst alleen de lokale kopie en muteert de opgeslagen layout niet', () => {
    const persisted = [
      { id: 'welcome', type: 'WELCOME' as const, position: 0, settings: {} },
      { id: 'reminders', type: 'MY_REMINDERS' as const, position: 1, settings: {} },
    ]

    const next = moveWidget(persisted, 'reminders', 'up')

    expect(next.map((widget) => widget.id)).toEqual(['reminders', 'welcome'])
    expect(persisted.map((widget) => widget.id)).toEqual(['welcome', 'reminders'])
    expect(next).not.toBe(persisted)
  })
})
