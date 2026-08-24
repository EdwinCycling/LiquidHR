import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RecruitmentOverviewDashboard, type RecruitmentOverviewLabels } from './recruitment-overview-dashboard'

const labels: RecruitmentOverviewLabels = {
  eyebrow: 'Sollicitaties',
  title: 'Recruitment',
  description: 'Beschrijving',
  newVacancy: 'Nieuwe vacature',
  summaryTitle: 'Kerncijfers',
  vacancies: 'Vacatures',
  openVacancies: 'Open vacatures',
  activeApplications: 'Actieve sollicitaties',
  newApplications: 'Nieuwe sollicitaties',
  applications: 'Sollicitaties',
  open: 'Open',
  draft: 'Concept',
  closed: 'Gesloten',
  archived: 'Gearchiveerd',
  vacancyListTitle: 'Vacatures',
  vacancyListDescription: 'Open een vacature',
  pipelineTitle: 'Pipeline',
  pipelineDescription: 'Bekijk de pipeline',
  openPipeline: 'Open pipeline',
  openApplications: 'open sollicitaties',
  noApplications: 'Geen open sollicitaties',
  hiredCount: '{count} aangenomen',
  rejectedCount: '{count} afgewezen',
  settings: 'Recruitmentinstellingen',
  assigned: 'Toegewezen sollicitaties',
  empty: 'Er zijn nog geen vacatures',
  emptyDescription: 'Maak een vacature aan',
  noCandidateAccess: 'Geen kandidaatrecht',
  analyticsUnavailable: 'Inzichten niet beschikbaar',
  loadErrorTitle: 'Overzicht niet beschikbaar',
  loadErrorDescription: 'Probeer opnieuw',
  retry: 'Opnieuw proberen',
  notAvailable: 'Niet beschikbaar',
}

describe('RecruitmentOverviewDashboard', () => {
  it('toont de lege state zonder create-actie in read-only mode', () => {
    const html = renderToStaticMarkup(
      <RecruitmentOverviewDashboard
        analytics={null}
        analyticsError={false}
        canCreateVacancy={false}
        canManageSettings={false}
        canReadAssigned={false}
        loadError={false}
        vacancies={[]}
        labels={labels}
      />,
    )

    expect(html).toContain('Er zijn nog geen vacatures')
    expect(html).toContain('Geen kandidaatrecht')
    expect(html).not.toContain('/recruitment/vacancies/new')
  })
})
