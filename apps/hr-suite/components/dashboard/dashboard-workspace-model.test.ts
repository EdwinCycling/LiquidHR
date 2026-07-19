import { describe, expect, it } from 'vitest'
import { addWidgetToDraft, moveWidget } from './dashboard-workspace-model'

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

it('voegt de standaardbreedte alleen aan het concept toe', () => {
  const persisted = [{ id: 'welcome', type: 'WELCOME' as const, position: 0, settings: {} }]
  const next = addWidgetToDraft(persisted, { type: 'MY_SALARY_HISTORY', title: 'Mijn salarishistorie', description: 'Verloop', category: 'COMPENSATION', categoryLabel: 'Beloning', visualization: 'LINE', visualizationLabel: 'Lijn', defaultWidth: 'TWO_THIRDS', widthLabel: 'Twee derde' })
  expect(next[1].settings.width).toBe('TWO_THIRDS')
  expect(persisted).toHaveLength(1)
})
