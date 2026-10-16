import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getEmploymentPayrollTaxDossier, getLocale, getTranslator, getUserPreferences } = vi.hoisted(() => ({
  getEmploymentPayrollTaxDossier: vi.fn(),
  getLocale: vi.fn(),
  getTranslator: vi.fn(),
  getUserPreferences: vi.fn(),
}))

vi.mock('@/lib/employment/employment-payroll-tax-profile-service', () => ({
  EmploymentPayrollTaxProfileError: class EmploymentPayrollTaxProfileError extends Error {
    constructor(message: string, readonly status: number) { super(message) }
  },
  getEmploymentPayrollTaxDossier,
}))
vi.mock('@/lib/preferences/server', () => ({ getUserPreferences }))
vi.mock('@/lib/i18n/server', () => ({ getLocale, getTranslator }))

import { renderToStaticMarkup } from 'react-dom/server'
import EmploymentFiscalDossierPage from './page'

const fixture = {
  employee: { id: 'employee-1', employeeNumber: 'E-100', displayName: 'Voorbeeld Medewerker' },
  employment: {
    id: 'employment-1', number: 'DV-100', startsOn: '2025-01-01', endsOn: null,
    recordStatus: 'CONFIRMED', employmentType: 'EMPLOYEE', contractType: 'PERMANENT',
  },
  administration: { id: 'administration-1', name: 'Mars BV' },
  incomeRelationships: [{
    linkId: 'link-1', incomeRelationshipId: 'ikv-1', ikvNumber: 100, relationshipType: 'EMPLOYMENT',
    reportingStatus: 'READY', startsOn: '2025-01-01', endsOn: null, validFrom: '2025-01-01', validUntil: null,
  }],
  payrollTaxNumbers: [],
  schedules: [{
    startsOn: '2025-01-01', endsOn: null, isOnCall: false, onCallObligation: null,
    workScope: null, averageHoursPerWeek: 40,
  }],
  taxProfiles: [],
  auditHistory: [],
  ageCategory: 'UNDER_AOW' as const,
}

describe('Employment fiscal dossier page', () => {
  beforeEach(() => {
    getEmploymentPayrollTaxDossier.mockReset().mockResolvedValue(fixture)
    getLocale.mockResolvedValue('nl')
    getTranslator.mockResolvedValue((key: string) => key)
    getUserPreferences.mockResolvedValue({ dateFormat: 'yyyy-MM-dd', timeFormat: 'HH:mm' })
  })

  it('keeps all seven dossier sections reachable through URL state', async () => {
    const tabs = ['general', 'taxes', 'other', 'insurance', 'taxBenefit', 'zvw', 'notes']
    for (const tab of tabs) {
      const markup = renderToStaticMarkup(await EmploymentFiscalDossierPage({
        params: Promise.resolve({ employeeId: 'employee-1', employmentId: 'employment-1' }),
        searchParams: Promise.resolve({ tab }),
      }))

      expect(markup).toContain(`tab=${tab}`)
      expect(markup).toContain(`id="fiscal-panel-${tab}"`)
      expect(markup).toContain('fiscalDossier.payrollNotGuaranteed')
    }
  })

  it('records only the administrative source in the HR-admin form and keeps unsupported rules visible', async () => {
    const taxes = renderToStaticMarkup(await EmploymentFiscalDossierPage({
      params: Promise.resolve({ employeeId: 'employee-1', employmentId: 'employment-1' }),
      searchParams: Promise.resolve({ tab: 'taxes' }),
    }))
    const insurance = renderToStaticMarkup(await EmploymentFiscalDossierPage({
      params: Promise.resolve({ employeeId: 'employee-1', employmentId: 'employment-1' }),
      searchParams: Promise.resolve({ tab: 'insurance' }),
    }))

    expect(taxes).toContain('name="sourceClassification" value="HR_ADMIN_CONFIRMED"')
    expect(taxes).not.toContain('value="EMPLOYEE_DECLARATION"')
    expect(taxes).toContain('fiscalDossier.calculationLimitDescription')
    expect(insurance).toContain('fiscalDossier.insuranceCalculationUnavailable')
  })
})
