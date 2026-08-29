import { describe, expect, it } from 'vitest'
import { calendarMonthForTimeZone, resolveHrGroupCalendarMonth, resolveHrGroupTimeZone } from './timezone'

const scope = { tenantId: 'tenant-1', hrGroupId: 'group-1', administrationId: null }

describe('AI HR-groep timezone contract', () => {
  it('gebruikt de HR-groep timezone bij de kalendermaandgrens', () => {
    const justBeforeAmsterdamMidnight = new Date('2026-07-31T22:30:00.000Z')
    expect(calendarMonthForTimeZone(justBeforeAmsterdamMidnight, 'Europe/Amsterdam')).toBe('2026-08')
  })

  it('gebruikt één resolver voor de maand en valideert de timezone', async () => {
    const resolver = { resolve: async () => 'Europe/Amsterdam' }
    await expect(resolveHrGroupTimeZone(scope, resolver)).resolves.toBe('Europe/Amsterdam')
    await expect(resolveHrGroupCalendarMonth(scope, new Date('2026-08-28T12:00:00.000Z'), resolver)).resolves.toBe('2026-08')
  })

  it('faalt gesloten voor een ongeldige timezone', async () => {
    await expect(resolveHrGroupTimeZone(scope, { resolve: async () => 'Not/A_Timezone' }))
      .rejects.toMatchObject({ code: 'INTERNAL_CONFIGURATION_ERROR' })
  })
})
