import type { AuthContext } from '@/lib/auth/permissions'
import type { HeRaToolCall } from './gemini'
import {
  countVisibleSalariesAbove,
  employeeSearchInputSchema,
  getVisibleEmployment,
  getVisibleOrganization,
  salaryThresholdInputSchema,
  searchVisibleEmployees,
  visibleEmploymentInputSchema,
  visibleOrganizationInputSchema,
  type SalaryThresholdInput,
  type EmployeeSearchInput,
  type VisibleEmploymentInput,
  type VisibleOrganizationInput,
} from './read-tools'

export class HeRaToolRegistryError extends Error {
  constructor(readonly code: 'HERA_TOOL_INPUT_INVALID' | 'HERA_TOOL_NOT_ALLOWED') {
    super(code)
  }
}

export interface HeRaToolRegistryDependencies {
  analyzeSalaryThreshold?: (
    context: AuthContext,
    input: SalaryThresholdInput,
  ) => Promise<unknown>
  searchEmployees?: (context: AuthContext, input: EmployeeSearchInput) => Promise<unknown>
  getEmployment?: (context: AuthContext, input: VisibleEmploymentInput) => Promise<unknown>
  getOrganization?: (context: AuthContext, input: VisibleOrganizationInput) => Promise<unknown>
}

export async function dispatchHeRaTool(
  context: AuthContext,
  call: HeRaToolCall,
  dependencies: HeRaToolRegistryDependencies = {},
): Promise<unknown> {
  if (call.name === 'analyze_salary_threshold') {
    const parsed = salaryThresholdInputSchema.safeParse(call.args)
    if (!parsed.success) throw new HeRaToolRegistryError('HERA_TOOL_INPUT_INVALID')
    return (dependencies.analyzeSalaryThreshold ?? countVisibleSalariesAbove)(
      context,
      parsed.data,
    )
  }
  if (call.name === 'search_visible_employees') {
    const parsed = employeeSearchInputSchema.safeParse(call.args)
    if (!parsed.success) throw new HeRaToolRegistryError('HERA_TOOL_INPUT_INVALID')
    return (dependencies.searchEmployees ?? searchVisibleEmployees)(context, parsed.data)
  }
  if (call.name === 'get_visible_employment') {
    const parsed = visibleEmploymentInputSchema.safeParse(call.args)
    if (!parsed.success) throw new HeRaToolRegistryError('HERA_TOOL_INPUT_INVALID')
    return (dependencies.getEmployment ?? getVisibleEmployment)(context, parsed.data)
  }
  if (call.name === 'get_visible_organization') {
    const parsed = visibleOrganizationInputSchema.safeParse(call.args)
    if (!parsed.success) throw new HeRaToolRegistryError('HERA_TOOL_INPUT_INVALID')
    return (dependencies.getOrganization ?? getVisibleOrganization)(context, parsed.data)
  }
  throw new HeRaToolRegistryError('HERA_TOOL_NOT_ALLOWED')
}
