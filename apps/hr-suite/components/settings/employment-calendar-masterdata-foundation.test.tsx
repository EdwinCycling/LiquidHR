import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { AbsenceSettingsForm } from './absence-settings-form'
import { AnniversaryRulesManager } from './anniversary-rules-manager'
import { EmploymentCatalogManager } from './employment-contract-settings'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))

describe('R7-3 Foundation convergence', () => {
  it('uses Foundation controls for absence settings and anniversary CRUD', () => {
    const absence = renderToStaticMarkup(<AbsenceSettingsForm
      caseManagers={[{ id: 'employee-1', employeeNumber: '1001', name: 'Ada Lovelace' }]}
      defaultCaseManagerEmployeeId="employee-1"
      employeeSelfReportEnabled
      frequentAbsenceThreshold={3}
      labels={{ threshold: 'Drempel', thresholdHelp: 'Hulp', caseManager: 'Begeleider', caseManagerHelp: 'Hulp', noCaseManager: 'Geen', save: 'Opslaan', saving: 'Opslaan…', saved: 'Opgeslagen', failed: 'Mislukt', invalid: 'Ongeldig', employeeSelfReport: 'Zelf melden', employeeSelfReportHelp: 'Hulp' }}
    />)
    const anniversary = renderToStaticMarkup(<AnniversaryRulesManager labels={{ add: 'Toevoegen', years: 'jaar', save: 'Opslaan', cancel: 'Annuleren', delete: 'Verwijderen', saved: 'Opgeslagen', failed: 'Mislukt', empty: 'Leeg' }} rules={[]} />)
    expect(absence).toContain('role="switch"')
    expect(absence).toContain('listbox')
    expect(anniversary).toContain('Toevoegen')
    expect(anniversary).toContain('border-dashed')
  })

  it('uses row actions and a Foundation surface for employment catalogs', () => {
    const markup = renderToStaticMarkup(<EmploymentCatalogManager
      catalog="FLEX_PHASE"
      labels={{ search: 'Zoeken', code: 'Code', name: 'Naam', add: 'Toevoegen', edit: 'Wijzigen', save: 'Opslaan', cancel: 'Annuleren', active: 'Actief', inactive: 'Inactief', activate: 'Activeren', deactivate: 'Deactiveren', empty: 'Leeg', failed: 'Mislukt' }}
      numericLabel={null}
      rows={[{ id: 'phase-1', code: 'P1', name: 'Fase 1', isActive: true, numericValue: null }]}
    />)
    expect(markup).toContain('aria-haspopup="menu"')
    expect(markup).toContain('Actief')
    expect(markup).toContain('border-border')
    expect(markup).not.toContain('window.confirm')
  })
})
