import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { TalentTeamMatrix } from './talent-team-matrix'
import type { TalentTeamMatrix as TalentTeamMatrixData } from '@/lib/talent/team-model'

vi.mock('next/navigation', () => ({
  usePathname: () => '/workforce/talent/team',
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

const labels: Parameters<typeof TalentTeamMatrix>[0]['labels'] = {
  title: 'Team Talent en Skills Matrix',
  subtitle: 'Direct team',
  search: 'Zoeken',
  searchPlaceholder: 'Zoek medewerker',
  type: 'Capabilitytype',
  status: 'Recordstatus',
  validity: 'Geldigheid',
  source: 'Bron',
  all: 'Alle',
  noResults: 'Geen resultaten',
  empty: 'Lege scope',
  employee: 'Medewerker',
  job: 'Functie',
  capabilities: 'capabilities',
  noCapabilities: 'Geen registraties',
  draft: 'Concept',
  released: 'Vrijgegeven',
  expired: 'Verlopen',
  self: 'Zelf ingevoerd',
  hr: 'HR ingevoerd',
  manager: 'Manager ingevoerd',
  imported: 'Geïmporteerd',
  scope: 'Scope',
  teamScope: 'Direct team',
  tenantScope: 'Tenantbreed',
  employeeDrilldown: 'Medewerkerdetail openen',
  aggregateDisabled: 'Aggregaten zijn uitgeschakeld.',
  filterSearch: 'Filteropties zoeken',
  filterNoOptions: 'Geen opties',
  typeCompetency: 'Competentie',
  typeSkill: 'Skill',
  typeKnowledge: 'Kennis',
  typeLanguage: 'Taal',
  typeCertificate: 'Certificaat',
  evidence: 'Bewijs',
  evidencePresent: 'Aanwezig',
  noEvidence: 'Niet aanwezig',
}

const data: TalentTeamMatrixData = {
  rows: [{
    employeeId: 'employee-1',
    employeeNumber: 'EMP-001',
    employeeLabel: 'Mila de Vries',
    jobTitle: 'Teamleider',
    departmentId: 'department-1',
    capabilities: [{
      id: 'record-1',
      capability_id: 'capability-1',
      status: 'RELEASED',
      source_type: 'HR_ENTERED',
      valid_from: '2026-08-01',
      valid_until: null,
      certificate_status: null,
      evidence_status: 'VERIFIED',
      certificate_code: null,
      capabilityName: 'Klantgesprekken',
      capabilityCode: 'SKILL-CUSTOMER',
      capabilityType: 'SKILL',
    }],
  }],
  scopeCount: 1,
  scopeType: 'TEAM',
  aggregatePolicy: 'DISABLED',
  aggregateMinimumGroupSize: 5,
  aggregateDisabled: true,
}

describe('TalentTeamMatrix presentation contract', () => {
  it('renders scoped identity, translated capability metadata and safe drilldown', () => {
    const markup = renderToStaticMarkup(<TalentTeamMatrix initial={data} labels={labels} />)
    expect(markup).toContain('/employees/employee-1')
    expect(markup).toContain('Klantgesprekken')
    expect(markup).toContain('Vrijgegeven')
    expect(markup).toContain('HR ingevoerd')
    expect(markup).toContain('Geldigheid')
    expect(markup).toContain('Aggregaten zijn uitgeschakeld.')
    expect(markup).not.toContain('>RELEASED<')
    expect(markup).not.toContain('>HR_ENTERED<')
  })

  it('uses a neutral empty state for an empty manager scope', () => {
    const markup = renderToStaticMarkup(<TalentTeamMatrix initial={{ ...data, rows: [], scopeCount: 0 }} labels={labels} />)
    expect(markup).toContain('Lege scope')
    expect(markup).not.toContain('Geen resultaten')
  })
})
