import { describe, expect, it } from 'vitest'
import { employeeInsightCsv } from './csv'

describe('employeeInsightCsv', () => {
  it('uses an Excel-compatible semicolon delimiter and preserves quoted values', () => {
    const csv = employeeInsightCsv([{
      administrationNumber: 'ADM-001', employeeNumber: 'EMP-001', employeeId: 'employee-1', employeeName: 'Mila "de Boer"', gender: 'FEMALE', age: 31,
      team: 'Operations', segment: 'CC-029', birthDate: null, startDate: '2024-01-01', endDate: null, reason: null,
    }])

    expect(csv).toBe('\uFEFFsep=;\r\n"Administratienr";"Medewerkernr";"Medewerker";"Geslacht";"Leeftijd";"Team";"Segment";"Einddatum";"Reden"\r\n"ADM-001";"EMP-001";"Mila ""de Boer""";"FEMALE";"31";"Operations";"CC-029";"";""')
  })
})
