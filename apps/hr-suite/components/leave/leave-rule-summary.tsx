'use client'

import { colorCodeToCssValue } from '@/lib/leave/colors'
import type { LeaveCatalog } from '@/lib/leave/leave-service'
import { formatContractHours } from './contract-hours-presentation'
import type { LeaveAccrualRule } from './leave-rule-presentation'

export type LeaveRuleSummaryLabels = {
  basis: string
  amount: string
  rate: string
  frequency: string
  timing: string
  expiry: string
  validity: string
  annualFullTimeEntitlement: string
  contractHours: string
  workedHours: string
  payrollPeriod: string
  fourWeekly: string
  monthly: string
  yearly: string
  upfront: string
  arrears: string
  hoursUnit: string
  perHour: string
  months: string
  noExpiry: string
  noValue: string
  decimalSeparator: string
}

function frequencyLabel(rule: LeaveAccrualRule, labels: LeaveRuleSummaryLabels): string {
  if (rule.accrual_frequency === 'PAYROLL_PERIOD') return labels.payrollPeriod
  if (rule.accrual_frequency === 'FOUR_WEEKLY') return labels.fourWeekly
  if (rule.accrual_frequency === 'MONTHLY') return labels.monthly
  return labels.yearly
}

function ruleValue(rule: LeaveAccrualRule, labels: LeaveRuleSummaryLabels): string {
  if (rule.accrual_basis === 'WORKED_HOURS') return `${formatContractHours(rule.accrual_rate, labels.decimalSeparator, 4)} ${labels.hoursUnit} ${labels.perHour}`
  return `${formatContractHours(rule.accrual_amount, labels.decimalSeparator)} ${labels.hoursUnit}`
}

function expiryValue(rule: LeaveAccrualRule, labels: LeaveRuleSummaryLabels): string {
  return rule.expiration_months === 0 ? labels.noExpiry : `${rule.expiration_months} ${labels.months}`
}

export function LeaveRuleSummary({ rule, leaveType, labels }: { rule: LeaveAccrualRule; leaveType: LeaveCatalog['leaveTypes'][number]; labels: LeaveRuleSummaryLabels }) {
  const details = [
    [labels.basis, rule.accrual_basis === 'WORKED_HOURS' ? labels.workedHours : labels.contractHours],
    [rule.accrual_basis === 'WORKED_HOURS' ? labels.rate : labels.annualFullTimeEntitlement, ruleValue(rule, labels)],
    [labels.frequency, frequencyLabel(rule, labels)],
    [labels.timing, rule.accrual_timing === 'UPFRONT' ? labels.upfront : labels.arrears],
    [labels.expiry, expiryValue(rule, labels)],
    [labels.validity, `${rule.valid_from} – ${rule.valid_until ?? labels.noValue}`],
  ]

  return <div className="min-w-0">
    <div className="flex items-center gap-2">
      <span aria-hidden="true" className="size-3 shrink-0 rounded-full" style={{ backgroundColor: colorCodeToCssValue(leaveType.color_code) }} />
      <p className="truncate font-semibold text-foreground">{leaveType.name}</p>
    </div>
    <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
      {details.map(([label, value]) => <div className="min-w-0" key={label}><dt className="inline font-medium text-foreground/70">{label}: </dt><dd className="inline">{value}</dd></div>)}
    </dl>
  </div>
}
