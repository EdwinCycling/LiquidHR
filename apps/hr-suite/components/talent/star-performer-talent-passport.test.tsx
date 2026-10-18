import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { StarPerformersDetail } from '@/lib/star-performers/v2-service'
import { StarPerformerTalentPassport } from './star-performer-talent-passport'

const labels = {
  detailTitle: 'Talentpaspoort',
  readOnly: 'Alleen lezen',
  employeeNumber: 'Medewerkernummer',
  department: 'Afdeling',
  notAssessed: 'Niet beoordeeld',
  approvedSignal: 'Goedgekeurd 9-grid-signaal',
  noApprovedSignal: 'Geen goedgekeurd 9-grid-signaal beschikbaar.',
  closedOn: 'gesloten op',
  movementUp: 'Omhoog',
  movementDown: 'Omlaag',
  movementStable: 'Stabiel',
  movementNew: 'Nieuw signaal',
  performance: 'Performance',
  potential: 'Potential',
  grid: 'Radar & vergelijking',
  skills: 'Vaardigheden & competenties',
  skillsDescription: 'Alleen bewezen niveaus en bewijsstatus worden getoond.',
  noSkills: 'Geen bewezen vaardigheden beschikbaar.',
  jobProfile: 'Functieprofiel',
  jobProfileDescription: 'Actief functieprofiel en Talentgegevens.',
  noJobProfile: 'Geen actief functieprofiel beschikbaar.',
  skillGaps: 'Belangrijkste gaps',
  noSkillGaps: 'Geen gaps.',
  developmentPlans: 'Actieve ontwikkelplannen',
  noDevelopmentPlans: 'Geen actieve ontwikkelplannen beschikbaar.',
  appraisal: 'Continuous Appraisal',
  noAppraisal: 'Geen relevante afspraken beschikbaar.',
  openGrid: 'Open 9-grid',
  openSkills: 'Open vaardigheden',
  openRoleExplorer: 'Open functieprofiel',
  openComparison: 'Open radarvergelijking',
  openDevelopment: 'Open ontwikkelplannen',
  openAppraisal: 'Open Continuous Appraisal',
  unavailable: 'Niet beschikbaar voor deze rol',
  criticality: 'Kritikaliteit',
  tags: 'Tags',
  noTags: 'Geen tags gekoppeld.',
}

const detail: StarPerformersDetail = {
  employee: {
    employeeId: '11111111-1111-4111-8111-111111111111',
    employeeNumber: 'R3-001',
    firstName: 'Anna',
    birthName: 'Vermeer',
    workEmail: 'anna@example.invalid',
    avatarUrl: null,
    departmentId: 'department-1',
    departmentName: 'Operations',
    jobId: 'job-1',
    jobName: 'HR adviseur',
    jobGroupId: 'group-1',
    jobGroupName: 'Service',
    assessment: { id: 'assessment-1', employeeId: '11111111-1111-4111-8111-111111111111', jobId: 'job-1', jobGroupId: 'group-1', criticalityLevel: 5, tagIds: ['tag-1'], updatedAt: '2026-10-17T08:00:00.000Z' },
    gridSignal: null,
  },
  tags: [{ id: 'tag-1', name: 'R3-STAR-DEMO', isActive: true, usageCount: 1 }],
  grid: { state: 'ready', signal: { campaignId: 'campaign-1', campaignName: '2026 H2', closedAt: '2026-10-10T10:00:00.000Z', performanceScore: 'HIGH', potentialScore: 'HIGH', gridCell: 'HIGH_HIGH', isHighHigh: true, movement: 'UP' } },
  skills: { state: 'ready', records: [{ id: 'skill-1', name: 'Gespreksvoering', type: 'COMPETENCY', level: 'Gevorderd', evidenceStatus: 'VERIFIED', status: 'RELEASED', source: 'HR', validUntil: null }] },
  jobProfile: { state: 'ready', profile: { id: 'profile-1', jobCode: 'HR-ADV', jobGroupName: 'Service', version: 2 }, gaps: [{ name: 'Dataveiligheid', status: 'GAP', currentLevel: 'BASIC', targetLevel: 'ADVANCED', rationale: 'Vereist voor de functie.' }] },
  development: { state: 'ready', plans: [{ id: 'plan-1', title: 'Leiderschap', status: 'ACTIVE', progressPercent: 40, periodStart: '2026-01-01', periodEnd: '2026-12-31' }] },
  appraisal: { state: 'ready', items: [{ id: 'item-1', title: 'Voortgangsgesprek', status: 'OPEN', occurredOn: '2026-10-01', dueOn: '2026-11-01', nextMeetingOn: '2026-11-15', itemType: 'CHECK_IN' }] },
  links: { grid: '/workforce/9-grid?employeeId=11111111-1111-4111-8111-111111111111', skills: '/workforce/talent?employeeId=11111111-1111-4111-8111-111111111111', roleExplorer: '/workforce/talent/role-explorer?employeeId=11111111-1111-4111-8111-111111111111', comparison: '/workforce/talent/comparison?employeeId=11111111-1111-4111-8111-111111111111', development: '/workforce/talent/goals?employeeId=11111111-1111-4111-8111-111111111111', appraisal: '/workforce/continuous-appraisal?employeeId=11111111-1111-4111-8111-111111111111', employee: '/employees/11111111-1111-4111-8111-111111111111' },
}

describe('Star performer talent passport', () => {
  it('renders the read-only profile with source links and independent signals', () => {
    const markup = renderToStaticMarkup(<StarPerformerTalentPassport detail={detail} labels={labels} locale="nl" />)

    expect(markup).toContain('Talentpaspoort')
    expect(markup).toContain('Anna Vermeer')
    expect(markup).toContain('Kritikaliteit 5/5')
    expect(markup).toContain('R3-STAR-DEMO')
    expect(markup).toContain('HIGH_HIGH')
    expect(markup).toContain('href="/workforce/9-grid?employeeId=11111111-1111-4111-8111-111111111111"')
    expect(markup).not.toContain('Opslaan')
  })
})
