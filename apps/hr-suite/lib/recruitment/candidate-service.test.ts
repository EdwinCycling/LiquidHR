import { describe, expect, it } from 'vitest'
import {
  buildCandidateIndexRows,
  parseCandidateIndexQuery,
  type CandidateIndexSourceData,
} from './candidate-service'

const candidateId = '11111111-1111-4111-8111-111111111111'
const otherCandidateId = '22222222-2222-4222-8222-222222222222'
const firstVacancyId = '33333333-3333-4333-8333-333333333333'
const secondVacancyId = '44444444-4444-4444-8444-444444444444'
const firstStageId = '55555555-5555-4555-8555-555555555555'
const secondStageId = '66666666-6666-4666-8666-666666666666'

const source: CandidateIndexSourceData = {
  candidates: [
    { id: candidateId, firstName: 'Zoe', lastName: 'Zuid', privateEmail: 'zoe@example.invalid', phone: null, possibleDuplicate: true, createdAt: '2026-08-01T10:00:00.000Z', updatedAt: '2026-08-04T10:00:00.000Z' },
    { id: otherCandidateId, firstName: 'Anna', lastName: 'Bakker', privateEmail: 'anna@example.invalid', phone: null, possibleDuplicate: false, createdAt: '2026-08-02T10:00:00.000Z', updatedAt: '2026-08-03T10:00:00.000Z' },
  ],
  applications: [
    { id: '77777777-7777-4777-8777-777777777777', candidateId, vacancyId: firstVacancyId, activeStageId: firstStageId, terminalOutcome: null, source: 'PUBLIC', createdAt: '2026-08-01T10:00:00.000Z', updatedAt: '2026-08-04T10:00:00.000Z' },
    { id: '88888888-8888-4888-8888-888888888888', candidateId, vacancyId: secondVacancyId, activeStageId: null, terminalOutcome: 'AFGEWEZEN', source: 'MANUAL', createdAt: '2026-08-02T10:00:00.000Z', updatedAt: '2026-08-03T10:00:00.000Z' },
    { id: '99999999-9999-4999-8999-999999999999', candidateId: otherCandidateId, vacancyId: firstVacancyId, activeStageId: secondStageId, terminalOutcome: null, source: 'MANUAL', createdAt: '2026-08-03T10:00:00.000Z', updatedAt: '2026-08-03T10:00:00.000Z' },
  ],
  vacancies: [
    { id: firstVacancyId, title: 'Product manager' },
    { id: secondVacancyId, title: 'HR adviseur' },
  ],
  stages: [
    { id: firstStageId, name: 'Screening', sortOrder: 1 },
    { id: secondStageId, name: 'Gesprek', sortOrder: 2 },
  ],
}

describe('candidate index query', () => {
  it('normaliseert URL-state en houdt ongeldige gesloten waarden veilig buiten de query', () => {
    expect(parseCandidateIndexQuery(new URLSearchParams({ q: '  R4-CAND ', state: 'ACTIVE', vacancy: firstVacancyId, stage: firstStageId, sort: 'NAME', page: '3' }))).toEqual({
      search: 'R4-CAND', state: 'ACTIVE', vacancyId: firstVacancyId, stageId: firstStageId, sort: 'NAME', page: 3,
    })
    expect(parseCandidateIndexQuery(new URLSearchParams('state=UNKNOWN&vacancy=not-a-guid&page=-4'))).toEqual({
      search: '', state: 'ALL', vacancyId: 'ALL', stageId: 'ALL', sort: 'RECENT', page: 1,
    })
  })

  it('behoudt meerdere sollicitatiecontexten zonder een globale kandidaatstatus te verzinnen', () => {
    const rows = buildCandidateIndexRows(source, parseCandidateIndexQuery(new URLSearchParams()))
    expect(rows[0]?.name).toBe('Zoe Zuid')
    expect(rows[0]?.applicationCount).toBe(2)
    expect(rows[0]?.applications.map((application) => application.vacancyTitle)).toEqual(['Product manager', 'HR adviseur'])
    expect(rows[0]?.applications.map((application) => application.state)).toEqual(['ACTIVE', 'AFGEWEZEN'])
  })

  it('combineert zoeken, vacature en sollicitatiestatus op de bestaande application-context', () => {
    const query = parseCandidateIndexQuery(new URLSearchParams({ q: 'Zoe', vacancy: firstVacancyId, state: 'ACTIVE' }))
    const rows = buildCandidateIndexRows(source, query)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.applications).toHaveLength(1)
    expect(rows[0]?.applications[0]?.vacancyTitle).toBe('Product manager')
    expect(rows[0]?.applications[0]?.state).toBe('ACTIVE')
  })

  it('kan op naam sorteren en levert een lege selectie voor no-results', () => {
    const sorted = buildCandidateIndexRows(source, parseCandidateIndexQuery(new URLSearchParams('sort=NAME')))
    expect(sorted.map((row) => row.name)).toEqual(['Anna Bakker', 'Zoe Zuid'])
    expect(buildCandidateIndexRows(source, parseCandidateIndexQuery(new URLSearchParams('q=R4-REC-CAND-NOT-FOUND')))).toEqual([])
  })
})
