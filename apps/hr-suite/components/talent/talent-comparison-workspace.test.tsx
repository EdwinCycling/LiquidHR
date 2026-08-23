import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { TalentComparisonWorkspace } from '@/lib/talent/comparison-service'
import { TalentComparisonWorkspace as Workspace } from './talent-comparison-workspace'

const labels = {
  title: 'Talentvergelijking', subtitle: 'Vergelijking', employee: 'Medewerker', employeeNumber: 'Personeelsnummer', profile: 'Functieprofiel', profileVersion: 'Profielversie', capability: 'Capability', typeCompetency: 'Competentie', typeSkill: 'Vaardigheid', typeKnowledge: 'Kennis', typeLanguage: 'Taal', typeCertificate: 'Certificaat', required: 'Verplicht', important: 'Belangrijk', optional: 'Optioneel', sourceSelf: 'Zelf ingevoerd', sourceHr: 'HR ingevoerd', sourceManager: 'Manager ingevoerd', sourceImported: 'Geïmporteerd', chooseEmployee: 'Kies medewerker', chooseProfile: 'Kies functieprofiel', search: 'Zoeken', compare: 'Vergelijken', empty: 'Kies een medewerker en functieprofiel.', noEmployees: 'Geen medewerkers', noProfiles: 'Geen profielen', noRequirements: 'Geen vereisten', requirements: 'Vereisten', target: 'Vereiste', current: 'Actuele registratie', requirementType: 'Type vereiste', rationale: 'Toelichting', match: 'Match', gap: 'Gap', missingEvidence: 'Bewijs ontbreekt', unknown: 'Onbekend', sourceVersion: 'Bronversie', sourceRecord: 'Bronrecord', noSourceRecord: 'Geen bronrecord', sourceType: 'Bron', validity: 'Geldigheid', noCurrentRecord: 'Geen actuele registratie', jobGroup: 'Functiegroep', currentJob: 'Huidige functie', currentScope: 'Actuele scope', asOf: 'Peildatum', openEmployee: 'Medewerker openen', openProfile: 'Profiel openen',
}

const workspace = {
  asOf: '2026-08-23',
  employees: [{ employeeId: '11111111-1111-4111-8111-111111111111', employeeNumber: 'EMP-001', employeeLabel: 'Ada Lovelace', jobId: '22222222-2222-4222-8222-222222222222', jobTitle: 'Software engineer' }],
  profiles: [{ profileVersionId: '33333333-3333-4333-8333-333333333333', jobId: '44444444-4444-4444-8444-444444444444', jobCode: 'ENG-01', jobGroupId: '55555555-5555-4555-8555-555555555555', jobGroupName: 'Engineering', profileVersion: 2 }],
  selectedEmployeeId: '11111111-1111-4111-8111-111111111111',
  selectedProfileVersionId: '33333333-3333-4333-8333-333333333333',
  comparison: {
    employee: { employeeId: '11111111-1111-4111-8111-111111111111', employeeNumber: 'EMP-001', employeeLabel: 'Ada Lovelace', jobId: '22222222-2222-4222-8222-222222222222', jobTitle: 'Software engineer' },
    profile: { profileVersionId: '33333333-3333-4333-8333-333333333333', jobId: '44444444-4444-4444-8444-444444444444', jobCode: 'ENG-01', jobGroupId: '55555555-5555-4555-8555-555555555555', jobGroupName: 'Engineering', profileVersion: 2 },
    sourceVersion: 2,
    requirements: [
      { requirementId: 'req-1', capabilityId: 'cap-1', capabilityCode: 'TS', capabilityName: 'TypeScript', capabilityType: 'SKILL', requirementType: 'REQUIRED', targetLevelCode: 'L3', currentLevelCode: 'L3', languageLevel: null, currentLanguageLevel: null, rationale: 'Build and maintain typed applications.', outcome: 'MATCH', sourceType: 'HR', validFrom: '2026-01-01', validUntil: null, sourceRecordId: 'record-match' },
      { requirementId: 'req-2', capabilityId: 'cap-2', capabilityCode: 'CERT', capabilityName: 'Security certificate', capabilityType: 'CERTIFICATE', requirementType: 'IMPORTANT', targetLevelCode: null, currentLevelCode: null, languageLevel: null, currentLanguageLevel: null, rationale: null, outcome: 'MISSING_EVIDENCE', sourceType: 'SELF', validFrom: '2026-01-01', validUntil: null, sourceRecordId: 'record-evidence' },
      { requirementId: 'req-3', capabilityId: 'cap-3', capabilityCode: 'NL', capabilityName: 'Dutch', capabilityType: 'LANGUAGE', requirementType: 'OPTIONAL', targetLevelCode: null, currentLevelCode: null, languageLevel: 'B2', currentLanguageLevel: null, rationale: null, outcome: 'GAP', sourceType: null, validFrom: null, validUntil: null, sourceRecordId: null },
      { requirementId: 'req-4', capabilityId: 'cap-4', capabilityCode: 'LEGACY', capabilityName: 'Legacy platform', capabilityType: 'KNOWLEDGE', requirementType: 'OPTIONAL', targetLevelCode: 'L2', currentLevelCode: null, languageLevel: null, currentLanguageLevel: null, rationale: null, outcome: 'UNKNOWN', sourceType: null, validFrom: null, validUntil: null, sourceRecordId: null },
    ],
  },
} satisfies TalentComparisonWorkspace

describe('Talent comparison workspace contract', () => {
  it('keeps GET URL-state, exposes all outcomes, and renders responsive matrix paths', () => {
    const markup = renderToStaticMarkup(createElement(Workspace, { action: '/workforce/talent/comparison', initial: workspace, labels, profileHref: '/workforce/talent' }))

    expect(markup).toContain('method="get"')
    expect(markup).toContain('name="employeeId"')
    expect(markup).toContain('name="profileVersionId"')
    expect(markup).toContain('Match: 1')
    expect(markup).toContain('Gap: 1')
    expect(markup).toContain('Bewijs ontbreekt: 1')
    expect(markup).toContain('Onbekend: 1')
    expect(markup).toContain('record-match')
    expect(markup).toContain('Geen actuele registratie')
    expect(markup).toContain('md:hidden')
    expect(markup).toContain('overflow-x-auto')
    expect(markup).toContain('href="/employees/11111111-1111-4111-8111-111111111111?tab=overview"')
    expect(markup).toContain('href="/workforce/talent"')
  })

  it('renders a distinct zero-scope state without comparison content', () => {
    const emptyWorkspace = { ...workspace, employees: [], profiles: [], selectedEmployeeId: null, selectedProfileVersionId: null, comparison: null }
    const markup = renderToStaticMarkup(createElement(Workspace, { action: '/workforce/talent/comparison', initial: emptyWorkspace, labels, profileHref: '/workforce/talent' }))

    expect(markup).toContain('Geen medewerkers')
    expect(markup).toContain('Kies een medewerker en functieprofiel.')
    expect(markup).not.toContain('record-match')
  })
})
