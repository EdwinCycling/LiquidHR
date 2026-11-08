import type { DevelopmentInsight } from './insights-service'

/** Match only the explicitly recorded employee and capability relation. */
export function matchingDevelopmentPlans(plans: DevelopmentInsight['plans'], employeeId: string, capabilityId: string) {
  return plans.filter(plan => plan.employeeId === employeeId && plan.capabilityId != null && plan.capabilityId === capabilityId)
}
