import { FixedDecimal, PayrollEngineError } from '@liquid-hr/payroll-engine'

/**
 * PFZW 2026 annual contribution formula, deliberately limited to the 32-hour
 * Jan / Kinderopvang TEST scenario. Callers must provide an accepted annual
 * full-time pensionable salary basis and confirm PFZW participation; this
 * module does not establish coverage or derive the person's salary scale. The
 * formula represents one employment only; variable pay, extra hours, leave,
 * illness adjustments, multiple employments, and cash reserves are out of scope.
 *
 * Official sources:
 * - PFZW Pensionreglement, July 2026, arts. 5.1-5.8, pp. 73-77:
 *   https://www.pfzw.nl/content/dam/pfzw/web/statuten-en-reglementen/Statuten%20en%20reglementen%20juli%202026.pdf
 * - PFZW UPA manual, 2026, pp. 9-10 (annual salary basis and RegLn ceiling):
 *   https://www.pfzw.nl/content/dam/pfzw/web/werkgevers/pensioenaangifte/2026_Handleiding-aanlevering-UPA-gegevens.pdf
 * - PFZW annual formulas, DTF precision, and 2026 examples:
 *   https://www.pfzw.nl/werkgevers/premie-en-factuur/premie-berekenen/hoe-bereken-ik.html
 * - PFZW rates/franchises effective 2026-01-01:
 *   https://www.pfzw.nl/werkgevers/premie-en-factuur/premiepercentages-en-franchises.html
 * - PFZW monthly UPA reporting cadence:
 *   https://www.pfzw.nl/werkgevers/pensioenaangifte/maandelijks.html
 * - Cao Kinderopvang arts. 4.2, 5.7, 6.1 and OAK decision dated 2025-12-23:
 *   https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/aantal-uren
 *   https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/eindejaarsuitkering
 *   https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/vakantietoeslag
 *   https://www.kinderopvang-werkt.nl/media/1881
 *
 * PFZW sets the annual full-time salary basis at participation start and then
 * each January 1. An ordinary in-year salary change is taken into account in
 * the next calendar year; the caller must supply the accepted salary from the
 * applicable basis date (UPA manual, pp. 9-10). PFZW also uses the preceding
 * December 31 situation to determine whether the year-end allowance is
 * structural and which percentage applies. For a 2026 basis the literal rule
 * points to the 2025 CAO rate (5.5%), while the 2026 cash allowance is 8%; the
 * sources reviewed do not provide a worked new-joiner example that confirms
 * this transition reading. This module therefore does not assemble the annual
 * salary basis or calculate cash reserves.
 *
 * The current sources above define annual formulas and monthly UPA reporting,
 * but do not specify the October 2026 payroll-period proration/allocation and
 * amount-rounding rule. This module therefore returns no October amount.
 */

export const PFZW_2026_JAN_KINDEROPVANG_TEST_SCOPE = 'JAN_KINDEROPVANG_TEST_2026' as const

const ZERO = FixedDecimal.fromInteger(BigInt(0))
const ANNUAL_BASIC_FRANCHISE = FixedDecimal.parse('17283')
const ANNUAL_BASIC_SALARY_CAP = FixedDecimal.parse('137800')
const ANNUAL_WIA_EXCESS_FRANCHISE = FixedDecimal.parse('79409')
const BASIC_TOTAL_RATE = FixedDecimal.parse('0.259')
const EMPLOYEE_BASIC_RATE = FixedDecimal.parse('0.129')
const EMPLOYER_BASIC_RATE = FixedDecimal.parse('0.13')
const EMPLOYEE_WIA_EXCESS_RATE = ZERO
const EMPLOYER_WIA_EXCESS_RATE = FixedDecimal.parse('0.034')
const PART_TIME_FACTOR = FixedDecimal.fromInteger(BigInt(32))
  .divide(FixedDecimal.fromInteger(BigInt(36)), 4, 'HALF_UP')

export interface Pfzw2026JanKinderopvangTestInput {
  readonly acceptedScope: typeof PFZW_2026_JAN_KINDEROPVANG_TEST_SCOPE
  readonly pfzwParticipationConfirmed: boolean
  /**
   * Full-time annual pensionable salary at PFZW's applicable basis date,
   * assembled from accepted source inputs before UPA rounding. Include eligible
   * allowances; this module does not infer salary components or apply the
   * Kinderopvang CAO salary tables.
   */
  readonly fullTimeAnnualPensionableSalaryAtPfzwBasisDateBeforeUpaRounding: FixedDecimal
}

export interface Pfzw2026JanKinderopvangTestResult {
  readonly annualized: {
    /** Exact formula values; they are not rounded to payroll cents. */
    readonly amountStatus: 'EXACT_FORMULA_UNROUNDED'
    readonly salaryBasisRule: 'PARTICIPATION_START_OR_JANUARY_1'
    readonly ordinaryInYearSalaryChangeRule: 'NEXT_CALENDAR_YEAR'
    /** UPA RegLn is the full-time annual salary rounded upward to whole euros. */
    readonly pensionableSalary: FixedDecimal
    readonly partTimeFactor: FixedDecimal
    readonly basicPremiumableSalary: FixedDecimal
    readonly basicPremiumGround: FixedDecimal
    readonly totalBasicPremium: FixedDecimal
    readonly employeeBasicPremium: FixedDecimal
    readonly employerBasicPremium: FixedDecimal
    readonly wiaExcessGround: FixedDecimal
    readonly employeeWiaExcessPremium: FixedDecimal
    readonly employerWiaExcessPremium: FixedDecimal
  }
  readonly octoberPeriod: {
    readonly status: 'UNSUPPORTED'
    readonly reasonCode: 'PFZW_2026_MONTHLY_PRORATION_AND_ROUNDING_UNVERIFIED'
  }
}

function maximum(left: FixedDecimal, right: FixedDecimal): FixedDecimal {
  return left.compare(right) >= 0 ? left : right
}

function minimum(left: FixedDecimal, right: FixedDecimal): FixedDecimal {
  return left.compare(right) <= 0 ? left : right
}

/**
 * Calculate annualized 2026 PFZW contribution formulas for the accepted
 * 32/36-hour Kinderopvang TEST scenario. The annual values are not the amount
 * due for a partial participation year or an October payroll period.
 */
export function calculatePfzw2026JanKinderopvangTest(
  input: Pfzw2026JanKinderopvangTestInput,
): Pfzw2026JanKinderopvangTestResult {
  if (input.acceptedScope !== PFZW_2026_JAN_KINDEROPVANG_TEST_SCOPE) {
    throw new PayrollEngineError('PFZW_2026_SCOPE_UNSUPPORTED', 'This PFZW rule is limited to the accepted Jan Kinderopvang TEST scope.')
  }
  if (input.pfzwParticipationConfirmed !== true) {
    throw new PayrollEngineError('PFZW_2026_PARTICIPATION_UNCONFIRMED', 'PFZW participation must be confirmed for this employment before calculating a contribution.')
  }
  if (input.fullTimeAnnualPensionableSalaryAtPfzwBasisDateBeforeUpaRounding.compare(ZERO) < 0) {
    throw new PayrollEngineError('PFZW_2026_NEGATIVE_PENSIONABLE_SALARY', 'The full-time annual pensionable salary cannot be negative.')
  }

  const pensionableSalary = input.fullTimeAnnualPensionableSalaryAtPfzwBasisDateBeforeUpaRounding.round(0, 'CEILING')
  const basicPremiumableSalary = minimum(pensionableSalary, ANNUAL_BASIC_SALARY_CAP)
  const basicPremiumGround = maximum(
    ZERO,
    basicPremiumableSalary.subtract(ANNUAL_BASIC_FRANCHISE),
  ).multiply(PART_TIME_FACTOR)
  const wiaExcessGround = maximum(
    ZERO,
    pensionableSalary.multiply(PART_TIME_FACTOR).subtract(ANNUAL_WIA_EXCESS_FRANCHISE),
  )

  return {
    annualized: {
      amountStatus: 'EXACT_FORMULA_UNROUNDED',
      salaryBasisRule: 'PARTICIPATION_START_OR_JANUARY_1',
      ordinaryInYearSalaryChangeRule: 'NEXT_CALENDAR_YEAR',
      pensionableSalary,
      partTimeFactor: PART_TIME_FACTOR,
      basicPremiumableSalary,
      basicPremiumGround,
      totalBasicPremium: basicPremiumGround.multiply(BASIC_TOTAL_RATE),
      employeeBasicPremium: basicPremiumGround.multiply(EMPLOYEE_BASIC_RATE),
      employerBasicPremium: basicPremiumGround.multiply(EMPLOYER_BASIC_RATE),
      wiaExcessGround,
      employeeWiaExcessPremium: wiaExcessGround.multiply(EMPLOYEE_WIA_EXCESS_RATE),
      employerWiaExcessPremium: wiaExcessGround.multiply(EMPLOYER_WIA_EXCESS_RATE),
    },
    octoberPeriod: {
      status: 'UNSUPPORTED',
      reasonCode: 'PFZW_2026_MONTHLY_PRORATION_AND_ROUNDING_UNVERIFIED',
    },
  }
}
