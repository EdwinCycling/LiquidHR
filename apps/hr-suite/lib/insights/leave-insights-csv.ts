import type { LeaveInsightsReport } from './leave-insights-types'

function cell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function row(values: readonly (string | number | null | undefined)[]): string {
  return values.map(cell).join(',')
}

export function leaveInsightsCsv(report: LeaveInsightsReport): string {
  const lines: string[] = [row(['view', report.query.view]), row(['as_of_date', report.query.asOfDate]), row(['period_start', report.query.periodStart]), row(['period_end', report.query.periodEnd]), '']
  if (report.query.view === 'expiry') {
    lines.push(row(['employee', 'employee_number', 'leave_type', 'source_year', 'accrual_year', 'cohort', 'expiry_date', 'days_until_expiry', 'remaining_hours', 'status']))
    for (const item of report.cohorts) lines.push(row([item.employeeName, item.employeeNumber, item.leaveTypeName, item.sourceAccrualYear, item.accrualYear, item.cohortKey, item.expirationDate, item.daysUntilExpiration, item.remainingHours, item.status]))
  } else if (report.query.view === 'usage') {
    lines.push(row(['employee', 'employee_number', 'leave_type', 'approved_requests', 'taken_hours', 'planned_hours', 'taken_days', 'planned_days', 'half_day_periods', 'full_day_periods', 'multi_day_periods', 'average_period_hours', 'median_period_hours']))
    for (const item of report.usage) lines.push(row([item.employeeName, item.employeeNumber, item.leaveTypeName, item.approvedRequestCount, item.takenHours, item.plannedHours, item.takenDays, item.plannedDays, item.halfDayCount, item.fullDayCount, item.multiDayPeriodCount, item.averagePeriodHours, item.medianPeriodHours]))
  } else if (report.query.view === 'capacity') {
    lines.push(row(['employee', 'employee_number', 'scheduled_hours', 'leave_hours', 'available_hours', 'leave_rate', 'non_workday_consumption', 'holiday_consumption']))
    for (const item of report.capacity) lines.push(row([item.employeeName, item.employeeNumber, item.scheduledHours, item.leaveHours, item.availableHours, item.leaveRate, item.nonWorkdayConsumption, item.holidayConsumption]))
    lines.push('', row(['date', 'scheduled_hours', 'leave_hours', 'available_hours', 'leave_rate', 'scheduled_employees', 'leave_employees']))
    for (const item of report.capacityDays) lines.push(row([item.date, item.scheduledHours, item.leaveHours, item.availableHours, item.leaveRate, item.employeeCount, item.leaveEmployeeCount]))
  } else if (report.query.view === 'accrual') {
    lines.push(row(['employee', 'employee_number', 'leave_type', 'profile', 'rule', 'basis', 'frequency', 'timing', 'annual_full_time_entitlement', 'part_time_factor', 'effective_entitlement', 'no_accrual', 'pause_leave_types', 'accrued_to_date', 'projected_accrual', 'migration_cutover']))
    for (const item of report.accrual) lines.push(row([item.employeeName, item.employeeNumber, item.leaveTypeName, item.profileName, item.ruleId, item.accrualBasis, item.accrualFrequency, item.accrualTiming, item.annualFullTimeEntitlement, item.partTimeFactor, item.effectiveEntitlement, item.noAccrual ? 'true' : 'false', item.pauseLeaveTypeNames.join('; '), item.accruedToDate, item.projectedAccrual, item.migrationCutoverDate]))
  } else if (report.query.view === 'mutations') {
    lines.push(row(['date', 'created_at', 'employee', 'employee_number', 'leave_type', 'class', 'amount', 'source_type', 'source_key', 'cohort', 'accrual_year', 'actor', 'reason']))
    for (const item of report.mutations) lines.push(row([item.transactionDate, item.createdAt, item.employeeName, item.employeeNumber, item.leaveTypeName, item.transactionType, item.amount, item.sourceType, item.sourceKey, item.cohortKey, item.accrualYear, item.actorDisplayName, item.reason]))
  } else if (report.query.view === 'finance') {
    lines.push(row(['employee', 'employee_number', 'leave_type', 'hours', 'hourly_rate', 'liability_amount', 'valuation_status', 'valuation_date', 'basis']))
    for (const item of report.finance) lines.push(row([item.employeeName, item.employeeNumber, item.leaveTypeName, item.hours, item.hourlyRate, item.liabilityAmount, item.valuationStatus, item.valuationDate, item.basisLabel]))
  } else if (report.query.view === 'contract-end') {
    lines.push(row(['employee', 'employee_number', 'contract_end', 'days_until_contract_end', 'balance_at_as_of', 'planned_through_contract_end', 'balance_at_contract_end']))
    for (const item of report.contractEnd) lines.push(row([item.employeeName, item.employeeNumber, item.contractEndDate, item.daysUntilContractEnd, item.balanceAtAsOf, item.plannedThroughContractEnd, item.balanceAtContractEnd]))
  } else if (report.query.view === 'year-close') {
    lines.push(row(['employee', 'employee_number', 'leave_type', 'ledger_balance', 'bucket_balance', 'difference', 'beginning_balance', 'opening_balance', 'accrual', 'positive_manual_adjustments', 'negative_manual_adjustments', 'taken', 'expired', 'ending_balance', 'control_status', 'status']))
    for (const item of report.yearClose) lines.push(row([item.employeeName, item.employeeNumber, item.leaveTypeName, item.ledgerBalance, item.bucketBalance, item.difference, item.beginningBalance, item.openingBalance, item.accrual, item.positiveManualAdjustments, item.negativeManualAdjustments, item.taken, item.expired, item.endingBalance, item.controlStatus, item.status]))
  } else if (report.query.view === 'exceptions') {
    lines.push(row(['employee', 'employee_number', 'leave_type', 'code', 'severity', 'details']))
    for (const item of report.exceptions) lines.push(row([item.employeeName, item.employeeNumber, item.leaveTypeName, item.code, item.severity, item.details]))
  } else {
    lines.push(row(['employee', 'employee_number', 'leave_type', 'as_of_balance', 'taken_to_date', 'future_planned', 'free_to_plan', 'reservoir_status']))
    for (const item of report.balances) lines.push(row([item.employeeName, item.employeeNumber, item.leaveTypeName, item.asOfBalance, item.takenToDate, item.futurePlanned, item.freeToPlan, item.reservoirStatus]))
  }
  return `\ufeff${lines.join('\r\n')}\r\n`
}
