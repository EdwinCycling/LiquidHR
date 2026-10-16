import type { EmployeePayrollStatement } from '@/lib/payroll/payroll-professional-service'

export type SalaryTrendRange = number | 'all'

export type SalaryTrendPoint = {
  readonly period: string
  readonly periodYear: number
  readonly periodMonth: number
  readonly gross: number | null
  readonly net: number | null
}

export type SalaryComponentChange = {
  readonly key: string
  readonly before: number
  readonly after: number
  readonly difference: number
  readonly percentage: number | null
}

export function salaryPeriodKey(statement: Pick<EmployeePayrollStatement, 'periodYear' | 'periodMonth'>): string {
  return `${statement.periodYear}-${String(statement.periodMonth).padStart(2, '0')}`
}

export function salaryComponentAmount(statement: EmployeePayrollStatement, key: string): number | null {
  const amount = statement.components.find((component) => component.key === key)?.amount
  return typeof amount === 'number' && Number.isFinite(amount) ? amount : null
}

export function salaryTrendPoints(
  statements: readonly EmployeePayrollStatement[],
  range: SalaryTrendRange = 'all',
): readonly SalaryTrendPoint[] {
  const points = statements
    .filter((statement) => Number.isInteger(statement.periodYear)
      && Number.isInteger(statement.periodMonth) && statement.periodMonth >= 1 && statement.periodMonth <= 12)
    .map((statement) => ({
      period: salaryPeriodKey(statement),
      periodYear: statement.periodYear,
      periodMonth: statement.periodMonth,
      gross: salaryComponentAmount(statement, 'gross_salary'),
      net: salaryComponentAmount(statement, 'net_salary'),
    }))
    .sort((left, right) => left.periodYear - right.periodYear || left.periodMonth - right.periodMonth)

  return range === 'all' ? points : points.slice(-Math.max(0, Math.floor(range)))
}

export function previousAvailableSalaryStatement(
  statement: EmployeePayrollStatement,
  statements: readonly EmployeePayrollStatement[],
): EmployeePayrollStatement | null {
  const ordered = [...statements].sort((left, right) =>
    right.periodYear - left.periodYear || right.periodMonth - left.periodMonth)
  const index = ordered.findIndex((candidate) => salaryPeriodKey(candidate) === salaryPeriodKey(statement))
  return index >= 0 ? ordered[index + 1] ?? null : null
}

export function salaryComponentChanges(
  current: EmployeePayrollStatement,
  previous: EmployeePayrollStatement,
  limit = 4,
): readonly SalaryComponentChange[] {
  const before = new Map(previous.components.flatMap((component) =>
    typeof component.amount === 'number' && Number.isFinite(component.amount)
      ? [[component.key, component.amount] as const]
      : []))
  const seen = new Set<string>()
  return current.components.flatMap((component) => {
    if (seen.has(component.key)) return []
    seen.add(component.key)
    if (component.key.startsWith('cumulative_') || component.key === 'gross_salary' || component.key === 'net_salary') return []
    const previousAmount = before.get(component.key)
    if (previousAmount === undefined || typeof component.amount !== 'number' || !Number.isFinite(component.amount)) return []
    const beforeCents = Math.round(previousAmount * 100)
    const afterCents = Math.round(component.amount * 100)
    const differenceCents = afterCents - beforeCents
    if (differenceCents === 0) return []
    return [{
      key: component.key,
      before: beforeCents / 100,
      after: afterCents / 100,
      difference: differenceCents / 100,
      percentage: beforeCents === 0 ? null : Math.round((differenceCents / beforeCents) * 10000) / 100,
    }]
  }).sort((left, right) => Math.abs(right.difference) - Math.abs(left.difference)).slice(0, Math.max(0, limit))
}
