import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { TalentWorkforceOverview, type TalentWorkforceEmployee, type TalentWorkforceOverviewLabels } from './talent-workforce-overview'

vi.mock('./talent-workforce-viewer', () => ({ TalentWorkforceViewer: () => <div>Functieprofielpaneel</div> }))
vi.mock('./talent-employee-capability-records', () => ({ TalentEmployeeCapabilityRecords: () => <div>Vaardighedenpaneel</div> }))

const employee: TalentWorkforceEmployee = {
  employeeId: 'employee-1',
  employeeNumber: 'EMP-001',
  employeeLabel: 'Mila de Vries',
  jobTitle: 'Teamleider',
  departmentName: 'People & Culture',
}

const labels: TalentWorkforceOverviewLabels = {
  tabsAriaLabel: 'Talentwerkgebieden',
  previousTab: 'Vorig werkgebied',
  nextTab: 'Volgend werkgebied',
  employeesTab: 'Medewerkers',
  profilesTab: 'Functieprofielen',
  skillsEvidenceTab: 'Vaardigheden & bewijs',
  compareDevelopTab: 'Vergelijken & ontwikkelen',
  employeeDirectory: {
    title: 'Medewerkers',
    description: 'Selecteer een medewerker.',
    search: 'Zoek medewerkers',
    searchPlaceholder: 'Naam, functie of afdeling',
    employeeNumber: 'Personeelsnummer',
    job: 'Functie',
    department: 'Afdeling',
    employeeCount: '{count} medewerkers',
    selectEmployee: 'Selecteer een medewerker.',
    selectedEmployee: 'Geselecteerde medewerker',
    openEmployee: 'Medewerker openen',
    teamMatrix: 'Teamoverzicht openen',
    noEmployees: 'Geen medewerkers.',
    noResults: 'Geen resultaten.',
    loadError: 'Laden mislukt.',
  },
  development: {
    title: 'Vergelijken & ontwikkelen',
    description: 'Vergelijk vaardigheden en verken ontwikkeling.',
    selectedEmployee: 'Geselecteerde medewerker',
    noEmployeeSelected: 'Selecteer eerst een medewerker.',
    currentJob: 'Functie',
    department: 'Afdeling',
    comparisonTitle: 'Talentvergelijking',
    comparisonDescription: 'Vergelijk de medewerker met een functieprofiel.',
    openComparison: 'Vaardigheden vergelijken',
    roleExplorerTitle: 'Functieverkenner',
    roleExplorerDescription: 'Verken de ontwikkeling ten opzichte van een functie.',
    openRoleExplorer: 'Ontwikkelradar openen',
  },
  profileLabels: {} as TalentWorkforceOverviewLabels['profileLabels'],
  recordLabels: {} as TalentWorkforceOverviewLabels['recordLabels'],
  manageProfiles: 'Functieprofielen beheren',
  manageSkills: 'Vaardigheden en bewijs beheren',
}

describe('Talent workforce overview', () => {
  it('groups the existing workspaces in four accessible areas and carries the selected employee into comparison', () => {
    const markup = renderToStaticMarkup(<TalentWorkforceOverview
      canCompare
      canManage={false}
      canTeam
      employeeState="ready"
      employees={[employee]}
      initialArea="develop"
      initialEmployeeId={employee.employeeId}
      labels={labels}
      profileState="ready"
      profiles={[]}
      recordState="ready"
      records={[]}
    />)

    expect(markup.match(/role="tab"/g)).toHaveLength(4)
    expect(markup).toContain('aria-label="Talentwerkgebieden"')
    expect(markup).toContain('aria-selected="true"')
    expect(markup).toContain('Mila de Vries')
    expect(markup).toContain('Teamleider · People &amp; Culture')
    expect(markup).toContain('href="/workforce/talent/comparison?employeeId=employee-1"')
    expect(markup).toContain('href="/workforce/talent/role-explorer?employeeId=employee-1"')
    expect(markup).toContain('id="talent-workforce-panel-develop"')
  })

  it('shows only work areas allowed by the caller permissions', () => {
    const markup = renderToStaticMarkup(<TalentWorkforceOverview
      canCompare={false}
      canManage={false}
      canTeam={false}
      employeeState="ready"
      employees={[employee]}
      initialArea="employees"
      labels={labels}
      profileState="ready"
      profiles={[]}
      recordState="ready"
      records={[]}
    />)

    expect(markup.match(/role="tab"/g)).toHaveLength(2)
    expect(markup).toContain('aria-selected="true"')
    expect(markup).toContain('Functieprofielen')
    expect(markup).toContain('Vaardigheden &amp; bewijs')
    expect(markup).not.toContain('id="talent-workforce-panel-employees"')
    expect(markup).not.toContain('id="talent-workforce-panel-develop"')
  })
})
