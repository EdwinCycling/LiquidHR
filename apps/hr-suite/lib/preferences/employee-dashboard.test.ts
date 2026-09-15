import { describe, expect, it } from 'vitest'
import { DEFAULT_EMPLOYEE_DASHBOARD_LAYOUT, parseEmployeeDashboardLayout } from './employee-dashboard-layout'

describe('parseEmployeeDashboardLayout', () => {
  it('keeps only known widgets in their fixed column and appends missing widgets', () => {
    const result = parseEmployeeDashboardLayout({ wide: ['activity', 'employment', 'activity'], narrow: ['personal'] })
    expect(result.wide[0]).toBe('aiSupport')
    expect(result.wide).toContain('activity')
    expect(result.wide).not.toContain('employment')
    expect(result.narrow[0]).toBe('employment')
    expect(result.narrow).not.toContain('activity')
  })

  it('accepts a reordered layout without losing a widget', () => {
    const result = parseEmployeeDashboardLayout({ wide: ['activity', 'personal'], narrow: ['documents', 'employment'] })
    expect(result.wide.slice(0, 3)).toEqual(['aiSupport', 'activity', 'personal'])
    expect(result.narrow.slice(0, 2)).toEqual(['documents', 'employment'])
    expect(result.wide).toHaveLength(DEFAULT_EMPLOYEE_DASHBOARD_LAYOUT.wide.length)
    expect(result.narrow).toHaveLength(DEFAULT_EMPLOYEE_DASHBOARD_LAYOUT.narrow.length)
  })

  it('keeps an explicit AI widget position after the user has customized the dashboard', () => {
    const result = parseEmployeeDashboardLayout({ wide: ['activity', 'aiSupport', 'personal'], narrow: [] })

    expect(result.wide.slice(0, 3)).toEqual(['activity', 'aiSupport', 'personal'])
  })
})
