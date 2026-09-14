import type {
  LeaveInsightsEmploymentFact, LeaveInsightsExceptionCode, LeaveInsightsFacts,
  LeaveInsightsFilterOption, LeaveInsightsQuery, LeaveInsightsReport, LeaveInsightsSeverity,
} from './leave-insights-types'
import { getMigrationCutoverDate } from '@/lib/leave/leave-engine'

const round = (value: number, decimals = 4): number => Number(value.toFixed(decimals))
const sum = (values: readonly number[]): number => round(values.reduce((total, value) => total + value, 0))
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0
const stable = <T>(rows: readonly T[]): T[] => [...rows].sort((a, b) => compare(JSON.stringify(a), JSON.stringify(b)))
const effective = (row: { validFrom: string; validUntil: string | null }, date: string): boolean =>
  row.validFrom <= date && (!row.validUntil || row.validUntil > date)
const key = (employmentId: string, leaveTypeId: string): string => JSON.stringify([employmentId, leaveTypeId])
const options = (pairs: readonly (readonly [string | null, string | null])[]): LeaveInsightsFilterOption[] =>
  [...new Map(stable(pairs).filter(([id]) => id !== null).map(([id, label]) => [id!, { value: id!, label: label ?? id! }])).values()]
    .sort((a, b) => compare(a.label, b.label) || compare(a.value, b.value))

/** Alleen canonieke feiten; prognoses trekken uitsluitend reeds goedgekeurde planning af. */
export function calculateLeaveInsightsReport(input: { query: LeaveInsightsQuery; facts: LeaveInsightsFacts }): LeaveInsightsReport {
  const { query, facts } = input
  const report: LeaveInsightsReport = {
    report: 'leave', query: { ...query }, balances: [], cohorts: [], usage: [], capacity: [], accrual: [],
    capacityDays: [], mutations: [], finance: [], contractEnd: [], yearClose: [], exceptions: [], financeAvailable: facts.financialValuations.length > 0,
    filterOptions: { departments: [], managers: [], leaveTypes: [], profiles: [], severities: [] },
    kpis: { employees: 0, employments: 0, balanceHours: 0, takenHours: 0, futurePlannedHours: 0,
      expiringHours: 0, expiring30Hours: 0, expiring60Hours: 0, expiring90Hours: 0, expiring180Hours: 0,
      carryForwardHours: 0, employeesWithReservoirSignal: 0, employeesWithoutTakenLeave: 0,
      employeesWithoutFutureLeave: 0, contractsEndingWithBalance: 0, exceptionCount: 0,
      valuedLiabilityHours: 0, valuedLiabilityAmount: null },
  }
  const inPeriod = (date: string): boolean => date >= query.periodStart && date <= query.periodEnd
  const transactions = stable(facts.transactions)
  const employmentById = new Map<string, LeaveInsightsEmploymentFact>()
  const approved = new Map(facts.requests.filter(row => row.status === 'APPROVED').map(row => [row.id, row]))
  const projected = stable(facts.projectedDays).filter(row => {
    const request = approved.get(row.requestId)
    return request?.employmentId === row.employmentId && request.employeeId === row.employeeId && inPeriod(row.date)
  })
  const addException = (employment: LeaveInsightsEmploymentFact, leaveTypeId: string | null,
    code: LeaveInsightsExceptionCode, severity: LeaveInsightsSeverity, details = code as string): void => {
    report.exceptions.push({ ...employment, leaveTypeId,
      leaveTypeName: facts.leaveTypes.find(type => type.id === leaveTypeId)?.name ?? null, code, severity, details })
  }

  for (const original of stable(facts.employments)) {
    const directAssignment = stable(facts.assignments.filter(row => row.employmentId === original.employmentId && effective(row, query.asOfDate)
      && facts.profiles.some(profile => profile.id === row.profileId && profile.isActive)))
      .sort((a, b) => compare(b.validFrom, a.validFrom))[0]
    const employeeSet = stable(facts.employeeSetMembers
      .filter(row => row.employeeId === original.employeeId && effective(row, query.asOfDate))
      .map(row => ({ member: row, set: facts.employeeSets.find(candidate => candidate.id === row.employeeSetId && candidate.isActive) }))
      .filter((row): row is { member: typeof row.member; set: NonNullable<typeof row.set> } => row.set !== undefined))
      .sort((a, b) => a.set.priority - b.set.priority || compare(a.set.name, b.set.name) || compare(a.set.id, b.set.id))[0]?.set
    const defaultProfile = facts.profiles.find(row => row.isActive && row.isGroupDefault)
    const hasAssignments = facts.assignments.some(row => row.employmentId === original.employmentId)
    const hasEmployeeSetFacts = facts.employeeSetMembers.some(row => row.employeeId === original.employeeId)
    const profileId = directAssignment?.profileId ?? employeeSet?.leaveProfileId ?? defaultProfile?.id
      ?? (!hasAssignments && !hasEmployeeSetFacts ? original.profileId : null)
    const profile = facts.profiles.find(row => row.id === profileId && row.isActive)
    const employment = { ...original, profileId, profileName: profile?.name ?? (profileId === original.profileId ? original.profileName : null) }
    if ((query.departmentId && employment.departmentId !== query.departmentId)
      || (query.managerId && employment.managerId !== query.managerId)
      || (query.profileId && employment.profileId !== query.profileId)) continue
    employmentById.set(employment.employmentId, employment)
    const employmentTransactions = transactions.filter(row => row.employmentId === employment.employmentId)
    const days = projected.filter(row => row.employmentId === employment.employmentId
      && row.date >= employment.startsOn && (!employment.endsOn || row.date <= employment.endsOn)
      && (!query.leaveTypeId || row.leaveTypeId === query.leaveTypeId))
    const rules = stable(facts.rules.filter(row => row.profileId === profileId && effective(row, query.asOfDate)))
    const types = stable(facts.leaveTypes).filter(type => (!query.leaveTypeId || type.id === query.leaveTypeId)
      && (rules.some(rule => rule.leaveTypeId === type.id)
        || facts.buckets.some(bucket => bucket.employmentId === employment.employmentId && bucket.leaveTypeId === type.id)
        || employmentTransactions.some(row => row.leaveTypeId === type.id)
        || days.some(row => row.leaveTypeId === type.id)
        || facts.allocations.some(row => row.employmentId === employment.employmentId && row.leaveTypeId === type.id)))
    for (const type of types) {
      const base = { ...employment, leaveTypeId: type.id, leaveTypeName: type.name }
      const allTransactions = employmentTransactions.filter(row => row.leaveTypeId === type.id)
      const ledger = allTransactions.filter(row => row.transactionDate <= query.asOfDate)
      const periodLedger = ledger.filter(row => inPeriod(row.transactionDate))
      const classSum = (transactionType: typeof ledger[number]['transactionType']): number =>
        sum(ledger.filter(row => row.transactionType === transactionType).map(row => row.amount))
      const typeDays = days.filter(row => row.leaveTypeId === type.id)
      const future = typeDays.filter(row => row.date > query.asOfDate)
      const planned = sum(future.map(row => row.hours))
      const balance = sum(ledger.map(row => row.amount))
      const takenToDate = -sum(ledger.filter(row => row.transactionType === 'TAKEN').map(row => row.amount))
      const taken = -sum(periodLedger.filter(row => row.transactionType === 'TAKEN').map(row => row.amount))
      const unlimited = type.entitlementMode === 'UNLIMITED'
      const rule = rules.filter(row => row.leaveTypeId === type.id).sort((a, b) => compare(b.validFrom, a.validFrom))[0]
      const exception = stable(facts.exceptions.filter(row => (!row.employmentId || row.employmentId === employment.employmentId)
        && (!row.leaveTypeId || row.leaveTypeId === type.id) && effective(row, query.asOfDate)))
        .sort((a, b) => compare(b.validFrom, a.validFrom))[0]
      const configuredAnnual = unlimited ? null
        : type.entitlementMode === 'ANNUAL_HOURS_CAP' ? type.annualHoursCap
          : type.entitlementMode === 'ANNUAL_HOURS_FTE_CAP' ? type.annualHoursFteCap
            : rule?.accrualBasis === 'CONTRACT_HOURS' ? exception?.accrualAmount ?? rule.accrualAmount : null
      const annualFullTime = configuredAnnual === null || configuredAnnual === undefined ? null : Number(configuredAnnual)
      const factor = employment.partTimeFactor
      const annual = unlimited || annualFullTime === null ? null
        : type.entitlementMode === 'ANNUAL_HOURS_FTE_CAP' || rule?.accrualBasis === 'CONTRACT_HOURS'
          ? factor === null ? null : round(annualFullTime * factor)
          : annualFullTime
      const noAccrual = exception?.noAccrual ?? false
      const effectiveAnnual = noAccrual ? 0 : annual
      const ratio = annual !== null && annual > 0 ? round(balance / annual) : null
      // De drempel is analytisch: de standaard 0,75 geeft HIGH vanaf 1,00
      // en CRITICAL vanaf 1,50. Het is geen wettelijke of cao-grens.
      const highThreshold = query.reservoirThreshold / 0.75
      const criticalThreshold = query.reservoirThreshold * 2
      const reservoirStatus = unlimited ? 'UNLIMITED' : ratio === null ? 'UNAVAILABLE'
        : ratio >= criticalThreshold ? 'CRITICAL' : ratio >= highThreshold ? 'HIGH'
          : ratio < 0.1 ? 'LOW' : 'HEALTHY'
      report.balances.push({ ...base, entitlementMode: type.entitlementMode, annualEntitlement: annual,
        annualFullTimeEntitlement: unlimited ? null : annualFullTime, openingBalance: unlimited ? null : classSum('OPENING_BALANCE'), accruedToDate: unlimited ? null : classSum('ACCRUAL'),
        manualAdjustment: classSum('MANUAL_ADJUSTMENT'), takenToDate: round(takenToDate),
        expiredToDate: round(-classSum('EXPIRED_DEDUCTION')), asOfBalance: unlimited ? null : balance,
        futurePlanned: unlimited ? null : planned, freeToPlan: unlimited ? null : round(balance - planned),
        projectedYearEnd: unlimited ? null : round(balance - sum(future.filter(row => row.date <= `${query.year}-12-31`).map(row => row.hours))),
        projectedContractEnd: unlimited || !employment.endsOn ? null : round(balance - planned), reservoirRatio: unlimited ? null : ratio, reservoirStatus })
      const typeRequests = stable([...new Set(typeDays.map(row => row.requestId))]).map(requestId => approved.get(requestId)).filter((request): request is NonNullable<typeof request> => request !== undefined)
      const periodHours = typeRequests.map(request => sum(typeDays.filter(row => row.requestId === request.id).map(row => row.hours))).filter(value => value > 0)
      const sortedPeriodHours = [...periodHours].sort((a, b) => a - b)
      const medianPeriodHours = sortedPeriodHours.length === 0 ? null : sortedPeriodHours.length % 2 === 1
        ? sortedPeriodHours[Math.floor(sortedPeriodHours.length / 2)]
        : round((sortedPeriodHours[sortedPeriodHours.length / 2 - 1] + sortedPeriodHours[sortedPeriodHours.length / 2]) / 2)
      const takenDates = periodLedger.filter(row => row.transactionType === 'TAKEN' && row.amount < 0).map(row => row.transactionDate).sort(compare)
      report.usage.push({ ...base, approvedRequestCount: new Set(typeDays.map(row => row.requestId)).size,
        takenHours: round(taken), plannedHours: planned,
        takenDays: new Set(typeDays.filter(row => row.date <= query.asOfDate && row.hours > 0).map(row => row.date)).size,
        plannedDays: new Set(future.filter(row => row.hours > 0).map(row => row.date)).size,
        halfDayCount: typeRequests.filter(request => request.timeMode === 'MORNING' || request.timeMode === 'AFTERNOON').length,
        fullDayCount: typeRequests.filter(request => request.timeMode === 'FULL_DAY').length,
        multiDayPeriodCount: typeRequests.filter(request => request.startDate < request.endDate).length,
        averagePeriodHours: periodHours.length ? round(sum(periodHours) / periodHours.length) : null,
        medianPeriodHours,
        firstTakenDate: takenDates[0] ?? null, lastTakenDate: takenDates.at(-1) ?? null })
      const cutover = getMigrationCutoverDate(ledger.map(row => ({ ...row, sourceType: row.sourceType ?? '' })), employment.employmentId, type.id)
      const pauseLeaveTypeIds = rule ? facts.rulePauseTypes.filter(row => row.accrualRuleId === rule.id).map(row => row.pauseLeaveTypeId) : []
      const pauseLeaveTypeNames = pauseLeaveTypeIds.map(id => facts.leaveTypes.find(candidate => candidate.id === id)?.name ?? id)
      report.accrual.push({ ...base, ruleId: rule?.id ?? null, accrualBasis: rule?.accrualBasis ?? null,
        accrualFrequency: rule?.accrualFrequency ?? null, accrualTiming: rule?.accrualTiming ?? null,
        accrualAmount: exception?.accrualAmount ?? rule?.accrualAmount ?? null, accrualRate: rule?.accrualRate ?? null,
        expirationMonths: exception?.expirationMonths ?? rule?.expirationMonths ?? null, annualFullTimeEntitlement: annualFullTime,
        partTimeFactor: factor, noAccrual, pauseLeaveTypeNames, accruedToDate: unlimited ? null : classSum('ACCRUAL'),
        projectedAccrual: null, effectiveEntitlement: unlimited ? null : effectiveAnnual, migrationCutoverDate: cutover,
        exceptionReason: exception?.reason ?? null,
        explanation: !profileId ? 'NO_EFFECTIVE_LEAVE_PROFILE' : !rule && type.entitlementMode === 'ACCRUAL'
          ? 'NO_EFFECTIVE_ACCRUAL_RULE' : noAccrual ? 'NO_ACCRUAL_EXCEPTION' : 'CANONICAL_LEDGER_ONLY' })
      const bucketById = new Map(facts.buckets.map(bucket => [bucket.id, bucket]))
      for (const transaction of periodLedger) report.mutations.push({ ...base, ...transaction,
        cohortKey: bucketById.get(transaction.bucketId)?.cohortKey ?? null,
        accrualYear: bucketById.get(transaction.bucketId)?.accrualYear ?? null,
        actorDisplayName: transaction.actorDisplayName ?? transaction.actorUserId, amount: round(transaction.amount) })
      if (!unlimited) {
        for (const bucket of stable(facts.buckets.filter(row => row.employmentId === employment.employmentId && row.leaveTypeId === type.id))) {
          const bucketLedger = ledger.filter(row => row.bucketId === bucket.id)
          if (!bucketLedger.length && bucket.accrualReferenceDate > query.asOfDate) continue
          const remaining = sum(bucketLedger.map(row => row.amount))
          const daysUntilExpiration = Math.round((Date.parse(`${bucket.expirationDate}T00:00:00Z`) - Date.parse(`${query.asOfDate}T00:00:00Z`)) / 86_400_000)
          const status = remaining <= 0 ? 'EMPTY' : daysUntilExpiration <= 0 ? 'EXPIRED_REMAINS' : daysUntilExpiration <= 90 ? 'EXPIRING_SOON' : 'ACTIVE'
          report.cohorts.push({ ...base, bucketId: bucket.id, sourceAccrualYear: bucket.sourceAccrualYear ?? bucket.accrualYear,
            accrualYear: bucket.accrualYear, cohortKey: bucket.cohortKey, expirationDate: bucket.expirationDate, daysUntilExpiration,
            accruedHours: sum(bucketLedger.filter(row => row.transactionType === 'OPENING_BALANCE' || row.transactionType === 'ACCRUAL').map(row => row.amount)),
            takenHours: round(-sum(bucketLedger.filter(row => row.transactionType === 'TAKEN').map(row => row.amount))),
            expiredHours: round(-sum(bucketLedger.filter(row => row.transactionType === 'EXPIRED_DEDUCTION').map(row => row.amount))), remainingHours: remaining, status })
          if (status === 'EXPIRED_REMAINS' || status === 'EXPIRING_SOON') addException(employment, type.id,
            status === 'EXPIRED_REMAINS' ? 'EXPIRED_COHORT_REMAINS' : 'COHORT_EXPIRING', status === 'EXPIRED_REMAINS' ? 'ACTION_REQUIRED' : 'ATTENTION', bucket.id)
        }
        const valuation = stable(facts.financialValuations.filter(row => row.employmentId === employment.employmentId))[0]
        const hourlyRate = valuation?.hourlyRate ?? null
        report.finance.push({ ...base, hours: balance, hourlyRate, liabilityAmount: hourlyRate === null ? null : round(balance * hourlyRate, 2),
          valuationStatus: hourlyRate === null ? 'UNAVAILABLE' : 'VALUED', basisLabel: valuation?.basisLabel ?? null, valuationDate: valuation?.valuationDate ?? null })
        if (facts.financialValuations.length > 0 && hourlyRate === null) addException(employment, type.id, 'MISSING_FINANCIAL_VALUATION_BASIS', 'INFO')
        if (balance < 0) addException(employment, type.id, 'NEGATIVE_BALANCE', 'ACTION_REQUIRED')
        if (reservoirStatus === 'HIGH' || reservoirStatus === 'CRITICAL') addException(employment, type.id,
          reservoirStatus === 'HIGH' ? 'HIGH_RESERVOIR' : 'CRITICAL_RESERVOIR', reservoirStatus === 'HIGH' ? 'ATTENTION' : 'ACTION_REQUIRED')
        // Buckettotalen hebben geen snapshotdatum: vergelijk alleen wanneer alle meegeleverde boekingen op/before de peildatum liggen.
        if (!allTransactions.some(row => row.transactionDate > query.asOfDate)) {
          const bucketBalance = sum(facts.buckets.filter(row => row.employmentId === employment.employmentId && row.leaveTypeId === type.id)
            .map(row => row.totalAccrued - row.totalTaken - row.totalExpired))
          const control = stable(facts.yearControls.filter(row => row.administrationId === employment.administrationId && row.year === query.year))[0]
          const yearStart = `${query.year}-01-01`
          const yearEnd = `${query.year + 1}-01-01`
          const yearLedger = allTransactions.filter(row => row.transactionDate >= yearStart && row.transactionDate < yearEnd && row.transactionDate <= query.asOfDate)
          const beginningBalance = sum(allTransactions.filter(row => row.transactionDate < yearStart && row.transactionDate <= query.asOfDate).map(row => row.amount))
          const openingBalance = sum(yearLedger.filter(row => row.transactionType === 'OPENING_BALANCE').map(row => row.amount))
          const accrualAmount = sum(yearLedger.filter(row => row.transactionType === 'ACCRUAL').map(row => row.amount))
          const positiveManualAdjustments = sum(yearLedger.filter(row => row.transactionType === 'MANUAL_ADJUSTMENT' && row.amount > 0).map(row => row.amount))
          const negativeManualAdjustments = -sum(yearLedger.filter(row => row.transactionType === 'MANUAL_ADJUSTMENT' && row.amount < 0).map(row => row.amount))
          const takenAmount = -sum(yearLedger.filter(row => row.transactionType === 'TAKEN').map(row => row.amount))
          const expiredAmount = -sum(yearLedger.filter(row => row.transactionType === 'EXPIRED_DEDUCTION').map(row => row.amount))
          const endingBalance = sum([beginningBalance, openingBalance, accrualAmount, positiveManualAdjustments, -negativeManualAdjustments, -takenAmount, -expiredAmount])
          const yearDifference = round(endingBalance - bucketBalance)
          report.yearClose.push({ ...base, ledgerBalance: endingBalance, bucketBalance, difference: yearDifference, beginningBalance, openingBalance,
            accrual: accrualAmount, positiveManualAdjustments, negativeManualAdjustments, taken: takenAmount, expired: expiredAmount, endingBalance, controlStatus: control?.status ?? 'UNAVAILABLE',
            status: yearDifference !== 0 ? 'MISMATCH' : control?.status === 'LOCKED' ? 'RECONCILED' : 'NOT_LOCKED' })
          if (yearDifference !== 0) {
            addException(employment, type.id, 'BALANCE_RECONCILIATION_MISMATCH', 'ACTION_REQUIRED')
            if (control?.status === 'LOCKED') addException(employment, type.id, 'YEAR_LOCK_INCONSISTENCY', 'ACTION_REQUIRED')
          }
        }
      }
      if (!unlimited && balance > 0 && taken === 0 && query.asOfDate >= query.periodStart) addException(employment, type.id, 'NO_LEAVE_TAKEN', 'INFO')
      if (!unlimited && balance > 0 && planned === 0 && query.asOfDate < query.periodEnd) addException(employment, type.id, 'NO_FUTURE_LEAVE_PLANNED', 'ATTENTION')
      if (!profileId) addException(employment, type.id, 'NO_EFFECTIVE_LEAVE_PROFILE', 'ACTION_REQUIRED')
      else if (!rule && type.entitlementMode === 'ACCRUAL') addException(employment, type.id, 'NO_EFFECTIVE_ACCRUAL_RULE', 'ACTION_REQUIRED')
      const manual = periodLedger.filter(row => row.transactionType === 'MANUAL_ADJUSTMENT')
      if (annual !== null && annual > 0 && manual.some(row => Math.abs(row.amount) >= annual * query.reservoirThreshold))
        addException(employment, type.id, 'LARGE_MANUAL_ADJUSTMENT', 'ATTENTION')
      if (manual.length >= 3) addException(employment, type.id, 'REPEATED_MANUAL_ADJUSTMENTS', 'ATTENTION')
      for (const day of typeDays.filter(row => row.hours > 0)) {
        if (facts.scheduleDays.some(row => row.employmentId === employment.employmentId && row.date === day.date && !row.isWorkingDay))
          addException(employment, type.id, 'NON_WORKDAY_CONSUMPTION', 'ACTION_REQUIRED', `${day.requestId}:${day.date}`)
        if (facts.holidays.has(day.date)) addException(employment, type.id, 'HOLIDAY_CONSUMPTION', 'ATTENTION', `${day.requestId}:${day.date}`)
      }
      if (!unlimited && employment.endsOn && employment.endsOn >= query.asOfDate && employment.endsOn <= query.periodEnd && round(balance - planned) !== 0)
        addException(employment, type.id, 'CONTRACT_END_WITH_BALANCE', 'ATTENTION')
      if (employment.deletedAt && employment.deletedAt.slice(0, 10) <= query.asOfDate && (balance !== 0 || future.length > 0))
        addException(employment, type.id, 'DELETED_EMPLOYMENT_HAS_ACTIVE_LEAVE_FACTS', 'ACTION_REQUIRED')
      const longAbsence = facts.absences.some((absence) => absence.employmentId === employment.employmentId
        && (absence.status === 'ACTIVE' || absence.status === 'RECOVERY_WINDOW')
        && absence.firstAbsenceOn <= query.asOfDate
        && Math.round((Date.parse(`${query.asOfDate}T00:00:00Z`) - Date.parse(`${absence.firstAbsenceOn}T00:00:00Z`)) / 86_400_000) >= 42)
      if (longAbsence && report.cohorts.some((cohort) => cohort.employmentId === employment.employmentId
        && cohort.leaveTypeId === type.id && cohort.remainingHours > 0 && cohort.daysUntilExpiration <= 180))
        addException(employment, type.id, 'LONG_TERM_ABSENCE_WITH_EXPIRY_REVIEW', 'ATTENTION')
    }
    const typeIds = new Set(types.map(row => row.id))
    for (const request of stable([...approved.values()].filter(row => row.employmentId === employment.employmentId && row.startDate <= query.periodEnd && row.endDate >= query.periodStart))) {
      const allocations = facts.allocations.filter(row => row.requestId === request.id && row.employmentId === employment.employmentId)
      const selected = allocations.filter(row => typeIds.has(row.leaveTypeId))
      const requestTypes = [...new Set([...selected.map(row => row.leaveTypeId),
        ...days.filter(row => row.requestId === request.id && typeIds.has(row.leaveTypeId)).map(row => row.leaveTypeId)])].sort(compare)
      const typeId = requestTypes[0]
      if (!typeId) continue
      if (round(sum(allocations.map(row => row.allocatedHours)) - request.requestedMinutes / 60) !== 0)
        addException(employment, typeId, 'REQUEST_ALLOCATION_MISMATCH', 'ACTION_REQUIRED', request.id)
      if (request.requestMode === 'PRIORITY') {
        const priority = facts.priorityRules.find(row => row.id === request.priorityRuleId)
        const items = facts.priorityItems.filter(row => row.priorityRuleId === request.priorityRuleId)
        if (!priority || !priority.isActive || priority.profileId !== profileId || !effective(priority, request.startDate)
          || items.length === 0
          || new Set(items.map(row => row.sortOrder)).size !== items.length
          || new Set(items.map(row => row.leaveTypeId)).size !== items.length)
          addException(employment, typeId, 'INVALID_PRIORITY_CONFIGURATION', 'ACTION_REQUIRED', request.id)
      }
      // De canonieke boekingssleutel is requestId:bucketId; onbeperkte allocaties hebben geen bucket.
      for (const allocation of selected.filter(row => row.bucketId !== null)) {
        const linked = employmentTransactions.filter(row => row.transactionType === 'TAKEN'
          && (row.sourceKey === request.id || row.sourceKey === `${request.id}:${allocation.bucketId}`)
          && row.leaveTypeId === allocation.leaveTypeId && row.bucketId === allocation.bucketId && row.transactionDate <= query.asOfDate)
        const allocated = sum(selected.filter(row => row.bucketId === allocation.bucketId && row.leaveTypeId === allocation.leaveTypeId).map(row => row.allocatedHours))
        if (request.endDate <= query.asOfDate && round(-sum(linked.map(row => row.amount)) - allocated) !== 0)
          addException(employment, allocation.leaveTypeId, 'TAKEN_ALLOCATION_MISMATCH', 'ACTION_REQUIRED', request.id)
      }
    }
  }

  report.exceptions = stable(report.exceptions.filter(row => !query.severity || row.severity === query.severity))
  const allowedPairs = new Set(report.exceptions.filter(row => row.leaveTypeId).map(row => key(row.employmentId, row.leaveTypeId!)))
  const keepPair = (row: { employmentId: string; leaveTypeId: string }): boolean => !query.severity || allowedPairs.has(key(row.employmentId, row.leaveTypeId))
  report.balances = report.balances.filter(keepPair)
  report.cohorts = report.cohorts.filter(keepPair)
  report.usage = report.usage.filter(keepPair)
  report.accrual = report.accrual.filter(keepPair)
  report.mutations = report.mutations.filter(keepPair)
  report.finance = report.finance.filter(keepPair)
  report.yearClose = report.yearClose.filter(keepPair)
  const employments = [...new Set(report.balances.map(row => row.employmentId))].map(id => employmentById.get(id)!)
  const capacityByDate = new Map<string, { scheduledHours: number; leaveHours: number; employeeCount: number; leaveEmployeeCount: number }>()
  for (const employment of employments) {
    const selected = report.balances.filter(row => row.employmentId === employment.employmentId)
    const typeIds = new Set(selected.map(row => row.leaveTypeId))
    const days = projected.filter(row => row.employmentId === employment.employmentId && typeIds.has(row.leaveTypeId)
      && row.date >= employment.startsOn && (!employment.endsOn || row.date <= employment.endsOn))
    const schedule = stable(facts.scheduleDays.filter(row => row.employmentId === employment.employmentId && inPeriod(row.date)
      && row.date >= employment.startsOn && (!employment.endsOn || row.date <= employment.endsOn)))
    const scheduleByDate = new Map(schedule.map(row => [row.date, row]))
    const nonWorkdays = days.filter(row => row.hours > 0 && scheduleByDate.get(row.date)?.isWorkingDay === false)
    const holidays = days.filter(row => row.hours > 0 && facts.holidays.has(row.date))
    const scheduledHours = sum(schedule.map(row => row.scheduledHours))
    const leaveHours = sum(days.map(row => row.hours))
    report.capacity.push({ ...employment, scheduledHours, leaveHours, availableHours: round(scheduledHours - leaveHours),
      scheduledDays: schedule.filter(row => row.isWorkingDay && row.scheduledHours > 0).length,
      leaveDays: new Set(days.filter(row => row.hours > 0).map(row => row.date)).size,
      leaveRate: scheduledHours > 0 ? round(leaveHours / scheduledHours * 100, 2) : 0,
      nonWorkdayConsumption: new Set(nonWorkdays.map(row => row.date)).size, holidayConsumption: new Set(holidays.map(row => row.date)).size })
    const leaveHoursByDate = new Map<string, number>()
    for (const day of days) leaveHoursByDate.set(day.date, (leaveHoursByDate.get(day.date) ?? 0) + day.hours)
    for (const date of new Set([...schedule.map((day) => day.date), ...leaveHoursByDate.keys()])) {
      const scheduled = schedule.find((day) => day.date === date)?.scheduledHours ?? 0
      const leave = round(leaveHoursByDate.get(date) ?? 0)
      const current = capacityByDate.get(date) ?? { scheduledHours: 0, leaveHours: 0, employeeCount: 0, leaveEmployeeCount: 0 }
      capacityByDate.set(date, { scheduledHours: current.scheduledHours + scheduled, leaveHours: current.leaveHours + leave,
        employeeCount: current.employeeCount + (scheduled > 0 ? 1 : 0), leaveEmployeeCount: current.leaveEmployeeCount + (leave > 0 ? 1 : 0) })
    }
    if (employment.endsOn && employment.endsOn >= query.asOfDate && employment.endsOn <= query.periodEnd) {
      const daysUntilContractEnd = Math.round((Date.parse(`${employment.endsOn}T00:00:00Z`) - Date.parse(`${query.asOfDate}T00:00:00Z`)) / 86_400_000)
      const balance = sum(selected.map(row => row.asOfBalance ?? 0))
      const planned = sum(selected.map(row => row.futurePlanned ?? 0))
      report.contractEnd.push({ ...employment, contractEndDate: employment.endsOn, daysUntilContractEnd, balanceAtAsOf: balance,
        plannedThroughContractEnd: planned, balanceAtContractEnd: round(balance - planned), hasBalance: round(balance - planned) !== 0 })
    }
  }
  report.capacityDays = [...capacityByDate.entries()].sort(([left], [right]) => compare(left, right)).map(([date, values]) => ({
    date, scheduledHours: round(values.scheduledHours), leaveHours: round(values.leaveHours), availableHours: round(values.scheduledHours - values.leaveHours),
    leaveRate: values.scheduledHours > 0 ? round(values.leaveHours / values.scheduledHours * 100, 2) : 0,
    employeeCount: values.employeeCount, leaveEmployeeCount: values.leaveEmployeeCount,
  }))
  report.exceptions = stable([...new Map(report.exceptions.filter(row => !query.severity || row.severity === query.severity)
    .map(row => [JSON.stringify(row), row])).values()])
  for (const name of ['balances', 'cohorts', 'usage', 'capacity', 'accrual', 'mutations', 'finance', 'contractEnd', 'yearClose'] as const)
    report[name].sort((a, b) => compare(a.employeeName, b.employeeName) || compare(a.employmentId, b.employmentId) || compare(JSON.stringify(a), JSON.stringify(b)))
  report.filterOptions = {
    departments: options(employments.map(row => [row.departmentId, row.departmentName])),
    managers: options(employments.map(row => [row.managerId, row.managerName])),
    profiles: options(employments.map(row => [row.profileId, row.profileName])),
    leaveTypes: options(report.balances.map(row => [row.leaveTypeId, row.leaveTypeName])),
    severities: options(report.exceptions.map(row => [row.severity, row.severity])),
  }
  const valued = report.finance.filter(row => row.valuationStatus === 'VALUED')
  const expiring = report.cohorts.filter(row => row.remainingHours > 0 && row.daysUntilExpiration > 0)
  const usageByEmployment = new Map<string, { taken: number; planned: number }>()
  for (const row of report.usage) {
    const current = usageByEmployment.get(row.employmentId) ?? { taken: 0, planned: 0 }
    usageByEmployment.set(row.employmentId, { taken: current.taken + row.takenHours, planned: current.planned + row.plannedHours })
  }
  report.kpis = { employees: new Set(employments.map(row => row.employeeId)).size, employments: employments.length,
    balanceHours: sum(report.balances.map(row => row.asOfBalance ?? 0)), takenHours: sum(report.usage.map(row => row.takenHours)),
    futurePlannedHours: sum(report.usage.map(row => row.plannedHours)),
    expiringHours: sum(report.cohorts.filter(row => row.status === 'EXPIRING_SOON').map(row => row.remainingHours)),
    expiring30Hours: sum(expiring.filter(row => row.daysUntilExpiration <= 30).map(row => row.remainingHours)),
    expiring60Hours: sum(expiring.filter(row => row.daysUntilExpiration <= 60).map(row => row.remainingHours)),
    expiring90Hours: sum(expiring.filter(row => row.daysUntilExpiration <= 90).map(row => row.remainingHours)),
    expiring180Hours: sum(expiring.filter(row => row.daysUntilExpiration <= 180).map(row => row.remainingHours)),
    carryForwardHours: sum(report.cohorts.filter(row => row.remainingHours > 0 && row.sourceAccrualYear < query.year).map(row => row.remainingHours)),
    employeesWithReservoirSignal: new Set(report.balances.filter(row => row.reservoirStatus === 'HIGH' || row.reservoirStatus === 'CRITICAL').map(row => row.employmentId)).size,
    employeesWithoutTakenLeave: new Set(employments.filter(row => (usageByEmployment.get(row.employmentId)?.taken ?? 0) === 0).map(row => row.employeeId)).size,
    employeesWithoutFutureLeave: new Set(employments.filter(row => (usageByEmployment.get(row.employmentId)?.planned ?? 0) === 0).map(row => row.employeeId)).size,
    contractsEndingWithBalance: report.contractEnd.filter(row => row.hasBalance).length,
    exceptionCount: report.exceptions.length, valuedLiabilityHours: sum(valued.map(row => row.hours)),
    valuedLiabilityAmount: valued.length ? round(sum(valued.map(row => row.liabilityAmount ?? 0)), 2) : null }
  return report
}
