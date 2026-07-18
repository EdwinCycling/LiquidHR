import { describe, expect, it } from 'vitest'
import { loadDashboardWidgetData } from './widget-loaders'

describe('dashboard widget loaders', () => {
  it('retourneert een eerlijke lege staat voor een nog niet aangesloten bron', async () => {
    const result = await loadDashboardWidgetData(
      { context: { tenantId: 'tenant', administrationId: null, userId: 'user', employeeId: null, activeRoles: [], permissions: [] }, supabase: null },
      { id: 'widget', type: 'MY_SALARY_HISTORY', position: 0, settings: {} },
    )

    expect(result).toEqual({ status: 'empty', reason: 'DATA_SOURCE_PENDING' })
  })
})
