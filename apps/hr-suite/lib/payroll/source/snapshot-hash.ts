import 'server-only'

import { createHash } from 'node:crypto'
import type { PayrollSourceSnapshot } from '@liquid-hr/payroll-engine'

type PayrollSourceHashInput = Pick<
  PayrollSourceSnapshot,
  | 'sourceTenantId'
  | 'sourceHrGroupId'
  | 'sourceAdministrationId'
  | 'sourceEmployeeId'
  | 'sourceEmploymentId'
  | 'sourceIncomeRelationshipId'
  | 'periodReference'
  | 'canonicalSource'
  | 'sourceVersionVector'
  | 'sourceGaps'
>

function stableSerialize(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Payroll source contains a non-finite number.')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`
  if (typeof value !== 'object') throw new TypeError('Payroll source contains a non-JSON value.')

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError('Payroll source contains a non-plain object.')

  const record = value as Record<string, unknown>
  const members = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
  return `{${members.join(',')}}`
}

export function hashPayrollSourceSnapshot(input: PayrollSourceHashInput): string {
  return createHash('sha256').update(stableSerialize(input), 'utf8').digest('hex')
}
