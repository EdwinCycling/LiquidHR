import { describe, expect, it } from 'vitest'
import {
  derivePayfull02MarsOracle,
  derivePayfull02MarsVariableOracle,
  PAYFULL02_MARS_ORACLE_SOURCE,
} from './payfull02-independent-oracle'

describe('independent PAYFULL-02 Mars payroll oracle', () => {
  it('checks DEMO-001 against the official 2026 white monthly table and independent cent arithmetic', () => {
    expect(derivePayfull02MarsOracle('DEMO-001')).toEqual({
      source: PAYFULL02_MARS_ORACLE_SOURCE,
      printedPage: 20,
      candidate: 'DEMO-001',
      grossAmount: '3517.00', taxableWage: '3325.07', wageTax: '1188.58',
      employeePension: '191.93', employerPension: '287.90', netReimbursement: '45.00',
      netDeduction: '0.00', netCorrection: '0.00', netPay: '2181.49',
      employerAwf: '257.36', employerAof: '208.48', employerWko: '16.63',
      employerWhk: '60.18', employerZvw: '202.83', employerPremiums: '745.48',
      holidayReserve: '281.36', yearEndReserve: '0.00', totalEmployerCost: '4876.74',
      cumulativeGross: '35170.00', cumulativeTaxableWage: '33250.70',
      cumulativeWageTax: '11885.80', cumulativeEmployeeInsuranceWage: '33250.70',
      cumulativeZvwWage: '33250.70', cumulativeHolidayReserve: '2813.60',
      cumulativeEmployeePension: '1919.30', cumulativeEmployerPension: '2879.00',
    })
  })

  it('checks DEMO-002 against a distinct published table row and premium/pension inputs', () => {
    expect(derivePayfull02MarsOracle('DEMO-002')).toEqual({
      source: PAYFULL02_MARS_ORACLE_SOURCE,
      printedPage: 20,
      candidate: 'DEMO-002',
      grossAmount: '3534.00', taxableWage: '3282.28', wageTax: '1173.42',
      employeePension: '251.72', employerPension: '251.72', netReimbursement: '32.50',
      netDeduction: '0.00', netCorrection: '0.00', netPay: '2141.36',
      employerAwf: '254.05', employerAof: '205.80', employerWko: '16.41',
      employerWhk: '59.41', employerZvw: '200.22', employerPremiums: '735.89',
      holidayReserve: '282.72', yearEndReserve: '0.00', totalEmployerCost: '4836.83',
      cumulativeGross: '35340.00', cumulativeTaxableWage: '32822.80',
      cumulativeWageTax: '11734.20', cumulativeEmployeeInsuranceWage: '32822.80',
      cumulativeZvwWage: '32822.80', cumulativeHolidayReserve: '2827.20',
      cumulativeEmployeePension: '2517.20', cumulativeEmployerPension: '2517.20',
    })
  })

  it('checks DEMO-003 with loonheffingskorting against the published 2026 table and its distinct opening basis', () => {
    expect(derivePayfull02MarsOracle('DEMO-003')).toEqual({
      source: PAYFULL02_MARS_ORACLE_SOURCE,
      printedPage: 20,
      candidate: 'DEMO-003',
      grossAmount: '3517.00', taxableWage: '3325.07', wageTax: '518.42',
      employeePension: '191.93', employerPension: '287.90', netReimbursement: '45.00',
      netDeduction: '0.00', netCorrection: '0.00', netPay: '2851.65',
      employerAwf: '257.36', employerAof: '208.48', employerWko: '16.63',
      employerWhk: '60.18', employerZvw: '202.83', employerPremiums: '745.48',
      holidayReserve: '281.36', yearEndReserve: '0.00', totalEmployerCost: '4876.74',
      cumulativeGross: '35476.00', cumulativeTaxableWage: '33526.10',
      cumulativeWageTax: '11322.20', cumulativeEmployeeInsuranceWage: '33526.10',
      cumulativeZvwWage: '33526.10', cumulativeHolidayReserve: '2838.08',
      cumulativeEmployeePension: '1949.90', cumulativeEmployerPension: '2924.90',
    })
  })

  it('checks the fixed €500 DEMO-001 regular variable-wage revision against its published table row', () => {
    expect(derivePayfull02MarsVariableOracle()).toEqual({
      source: PAYFULL02_MARS_ORACLE_SOURCE,
      printedPage: 23,
      candidate: 'DEMO-001',
      grossAmount: '4017.00', taxableWage: '3775.07', wageTax: '1357.67',
      employeePension: '241.93', employerPension: '362.90', netReimbursement: '45.00',
      netDeduction: '0.00', netCorrection: '0.00', netPay: '2462.40',
      employerAwf: '292.19', employerAof: '236.70', employerWko: '18.88',
      employerWhk: '68.33', employerZvw: '230.28', employerPremiums: '846.38',
      holidayReserve: '321.36', yearEndReserve: '0.00', totalEmployerCost: '5592.64',
      cumulativeGross: '35670.00', cumulativeTaxableWage: '33700.70',
      cumulativeWageTax: '12054.89', cumulativeEmployeeInsuranceWage: '33700.70',
      cumulativeZvwWage: '33700.70', cumulativeHolidayReserve: '2853.60',
      cumulativeEmployeePension: '1969.30', cumulativeEmployerPension: '2954.00',
    })
  })

  it('uses the official Belastingdienst 2026 table source', () => {
    expect(PAYFULL02_MARS_ORACLE_SOURCE.whiteMonthlyTable).toContain('belastingdienst.nl')
    expect(PAYFULL02_MARS_ORACLE_SOURCE.printedPage).toBe(20)
  })
})
