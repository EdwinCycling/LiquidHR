import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { PayrollSetupReadModel } from '@/lib/payroll/payroll-setup-service'
import enMessages from '@/messages/en/payrollProfessional.json'
import nlMessages from '@/messages/nl/payrollProfessional.json'
import { PayrollOpeningCumulativePanel } from './payroll-opening-cumulative-panel'

const opening = {
  schemaVersion: 'payroll-opening-cumulative-v1',
  sourcePeriodFrom: '2026-01-01',
  sourcePeriodTo: '2026-09-30',
  asOfDate: '2026-09-30',
  sourceReference: 'PAYFAST-LISA-READONLY-TEST',
  meaning: {
    grossWageBeforePeriod: '49500.00',
    taxableWageBeforePeriod: '47000.00',
    wageTaxBeforePeriod: '12000.00',
    employeeInsuranceWageBeforePeriod: '47000.00',
    zvwWageBeforePeriod: '47000.00',
    holidayReserveBeforePeriod: '3960.00',
    yearEndReserveBeforePeriod: '0.00',
  },
}
const snapshotHash = 'a'.repeat(64)
const setup = {
  employeeOptions: [{
    employeeId: '10000000-0000-4000-8000-000000000001',
    employmentId: '20000000-0000-4000-8000-000000000001',
    employeeNumber: 'SYN-001',
    employeeName: 'Lisa Test',
    employmentNumber: 'EMP-001',
    startsOn: '2026-01-01',
    endsOn: null,
  }],
  openingSnapshots: [{
    id: '30000000-0000-4000-8000-000000000001',
    payroll_administration_id: '40000000-0000-4000-8000-000000000001',
    source_tenant_id: '50000000-0000-4000-8000-000000000001',
    source_hr_group_id: '60000000-0000-4000-8000-000000000001',
    source_administration_id: '70000000-0000-4000-8000-000000000001',
    source_employment_id: '20000000-0000-4000-8000-000000000001',
    snapshot_version: 5,
    as_of_date: '2026-09-30',
    opening_balance_json: opening,
    snapshot_hash: snapshotHash,
    provenance_status: 'TEST_OPENING_BALANCE',
    provenance_source: 'PAYFAST-LISA-READONLY-TEST',
    created_at: '2026-10-01T00:00:00.000Z',
  }],
} as unknown as PayrollSetupReadModel
const legacySnapshot = {
  ...setup.openingSnapshots[0],
  id: '30000000-0000-4000-8000-000000000002',
  snapshot_version: 4,
  provenance_source: 'PAYRUN01 TEST PERSONA ASSIGNMENT',
  opening_balance_json: {
    sourcePeriodFrom: '2026-01-01',
    sourcePeriodTo: '2026-09-30',
    cumulativeBalances: Object.fromEntries(Object.entries(opening.meaning).map(([key, value]) => [key, Number(value)])),
  },
}

const balanceKeys = [
  'grossWageBeforePeriod',
  'taxableWageBeforePeriod',
  'wageTaxBeforePeriod',
  'employeeInsuranceWageBeforePeriod',
  'zvwWageBeforePeriod',
  'holidayReserveBeforePeriod',
  'yearEndReserveBeforePeriod',
] as const

describe('PayrollOpeningCumulativePanel read-only history', () => {
  it.each([
    ['nl-NL', nlMessages],
    ['en-GB', enMessages],
  ] as const)('expands every stored balance with its date, source, and full hash (%s)', (_language, labels) => {
    const markup = renderToStaticMarkup(<PayrollOpeningCumulativePanel
      setup={setup}
      canWrite={false}
      labels={labels}
    />)

    expect(markup).toContain('<details')
    expect(markup).not.toMatch(/<details[^>]*\bopen(?:=|\s|>)/u)
    expect(markup).not.toContain('<form')
    expect(markup).toContain(labels.openingBalanceAmountsTitle)
    expect(markup).toContain('2026-09-30')
    expect(markup).toContain('PAYFAST-LISA-READONLY-TEST')
    expect(markup).toContain(snapshotHash)

    for (const key of balanceKeys) {
      expect(markup).toContain(labels[key])
      expect(markup).toContain(opening.meaning[key])
    }
  })

  it('reads the legacy cumulativeBalances shape supported by the Payroll source provider', () => {
    const markup = renderToStaticMarkup(<PayrollOpeningCumulativePanel
      setup={{ ...setup, openingSnapshots: [legacySnapshot] }}
      canWrite={false}
      labels={nlMessages}
    />)

    expect(markup).toContain('2026-09-30')
    expect(markup).toContain('PAYRUN01 TEST PERSONA ASSIGNMENT')
    expect(markup).toContain(snapshotHash)
    for (const key of balanceKeys) expect(markup).toContain(String(Number(opening.meaning[key])))
  })
})
