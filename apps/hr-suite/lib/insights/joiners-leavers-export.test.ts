import { describe, expect, it } from 'vitest'
import type { JoinersLeaversEvent } from './joiners-leavers-calculation'
import { joinersLeaversCsv } from './joiners-leavers-csv'
import type { JoinersLeaversReport } from './joiners-leavers-service'
import { paginateJoinersLeaversRows } from './joiners-leavers-query'

function row(index: number): JoinersLeaversReport['rows'][number] {
  const base: JoinersLeaversEvent = {
    id: `start:${index}`, sourceId: `employment-${index}`, eventDate: `2025-03-${String((index % 28) + 1).padStart(2, '0')}`,
    month: '2025-03', eventType: 'employment-start', employeeId: `employee-${index}`, employmentId: `employment-${index}`,
    employmentNumber: `J-${index}`, administrationId: 'admin-a', departmentId: 'department-a', teamId: 'manager-a',
    placementStatus: 'ASSIGNED', employeeFlow: 'ENTERED_SCOPE', terminationWorkflowStatus: null,
    terminationDateMatchesEmploymentEnd: null, linkedTerminationCount: 0, reconciliationReason: null,
  }
  return {
    ...base,
    employeeNumber: `E-${index}`,
    employeeName: index === 0 ? '=2+2' : `Employee ${index}`,
    administrationName: 'Administration A',
    departmentName: 'Department A',
    teamName: 'Manager A',
  }
}

describe('Joiners & Leavers CSV', () => {
  it('localizes headers, protects formula cells and exports every report row beyond the visible page', () => {
    const rows = Array.from({ length: 27 }, (_, index) => row(index))
    const csv = joinersLeaversCsv({ rows } satisfies Pick<JoinersLeaversReport, 'rows'>, 'en')
    expect(csv).toContain('Employee no.')
    expect(csv).toContain("'=2+2")
    expect(csv).toContain('2025-03-27')
    expect(csv.split('\r\n')).toHaveLength(rows.length + 2)
    expect(paginateJoinersLeaversRows(rows, 1).rows).toHaveLength(25)
  })

  it('uses Dutch column headers and translated event labels', () => {
    const csv = joinersLeaversCsv({ rows: [row(1)] } satisfies Pick<JoinersLeaversReport, 'rows'>, 'nl')
    expect(csv).toContain('Medewerkernr')
    expect(csv).toContain('Start dienstverband')
  })
})
