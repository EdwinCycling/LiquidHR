import { beforeEach, describe, expect, it, vi } from 'vitest'
import { redirect } from 'next/navigation'
import LegacyDashboardPage from './dashboard/page'
import LegacyDashboardWidgetSettingsPage from './settings/dashboard-widgets/page'

vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

describe('legacy Dashboard routes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('redirects /dashboard to the Analyse hub', () => {
    LegacyDashboardPage()

    expect(redirect).toHaveBeenCalledWith('/insights/analysis')
  })

  it('redirects legacy Dashboard Widget settings to the Analyse hub', () => {
    LegacyDashboardWidgetSettingsPage()

    expect(redirect).toHaveBeenCalledWith('/insights/analysis')
  })
})
