import type { LeaveCatalog } from '@/lib/leave/leave-service'

export type LeaveAccrualRule = LeaveCatalog['accrualRules'][number]

function compareRules(left: LeaveAccrualRule, right: LeaveAccrualRule): number {
  return left.valid_from.localeCompare(right.valid_from) || left.id.localeCompare(right.id)
}

export function isCurrentLeaveAccrualRule(rule: LeaveAccrualRule, asOfDate = new Date().toISOString().slice(0, 10)): boolean {
  return rule.valid_from <= asOfDate && (rule.valid_until === null || rule.valid_until >= asOfDate)
}

export function currentRulesForProfile(catalog: LeaveCatalog, profileId: string, asOfDate?: string): LeaveAccrualRule[] {
  const latestByLeaveType = new Map<string, LeaveAccrualRule>()
  for (const rule of catalog.accrualRules.filter((item) => item.leave_profile_id === profileId && isCurrentLeaveAccrualRule(item, asOfDate))) {
    const previous = latestByLeaveType.get(rule.leave_type_id)
    if (!previous || compareRules(previous, rule) < 0) latestByLeaveType.set(rule.leave_type_id, rule)
  }
  return [...latestByLeaveType.values()].sort((left, right) => {
    const leftName = catalog.leaveTypes.find((type) => type.id === left.leave_type_id)?.name ?? ''
    const rightName = catalog.leaveTypes.find((type) => type.id === right.leave_type_id)?.name ?? ''
    return leftName.localeCompare(rightName) || compareRules(left, right)
  })
}

export function profilesUsingLeaveType(catalog: LeaveCatalog, leaveTypeId: string, asOfDate?: string): LeaveCatalog['profiles'] {
  const profileIds = new Set(
    catalog.accrualRules
      .filter((rule) => rule.leave_type_id === leaveTypeId && isCurrentLeaveAccrualRule(rule, asOfDate))
      .map((rule) => rule.leave_profile_id),
  )
  return catalog.profiles
    .filter((profile) => profileIds.has(profile.id))
    .sort((left, right) => left.name.localeCompare(right.name))
}

export function profileHasCurrentRule(catalog: LeaveCatalog, profileId: string, leaveTypeId: string, asOfDate?: string): boolean {
  return currentRulesForProfile(catalog, profileId, asOfDate).some((rule) => rule.leave_type_id === leaveTypeId)
}
