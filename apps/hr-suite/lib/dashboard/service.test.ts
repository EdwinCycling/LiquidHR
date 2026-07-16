import { describe, expect, it } from 'vitest'
import { defaultDashboardWidgets, validateDashboardLayout } from './service'

describe('personal dashboard service helpers', () => {
  it('maakt één standaardindeling met de vier goedgekeurde widgets', () => {
    expect(defaultDashboardWidgets()).toEqual([
      { type: 'WELCOME', position: 0 },
      { type: 'MY_REMINDERS', position: 1 },
      { type: 'ORGANIZATION_OVERVIEW', position: 2 },
      { type: 'EMPLOYEE_OVERVIEW', position: 3 },
    ])
  })

  it('weigert een indeling met dubbele posities', () => {
    expect(() => validateDashboardLayout({ widgets: [{ type: 'WELCOME', position: 0 }, { type: 'MY_REMINDERS', position: 0 }] })).toThrow('DASHBOARD_LAYOUT_INVALID')
  })
})
