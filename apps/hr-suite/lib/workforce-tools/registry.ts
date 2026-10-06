import { ZodError, z } from 'zod'
import { requireAuthContext, requirePermission } from '@/lib/auth/permissions'
import { ContextSelectionRequiredError } from '@/lib/context/administration-context'
import { ModuleError, requireTenantModule } from '@/lib/modules/module-service'
import {
  getWorkforceTool,
  getWorkforceToolByHeRaName,
  WORKFORCE_TOOL_CATALOG,
} from './catalog'
import type { WorkforceToolDefinition, WorkforceToolScope, WorkforceToolAudience } from './contracts'

export type WorkforceToolDispatchErrorCode =
  | 'TOOL_NOT_FOUND'
  | 'INPUT_INVALID'
  | 'RESULT_INVALID'
  | 'AUTHENTICATION_REQUIRED'
  | 'ACCESS_DENIED'
  | 'CONTEXT_SELECTION_REQUIRED'
  | 'RESOURCE_NOT_FOUND'
  | 'MODULE_INACTIVE'
  | 'EXECUTION_FAILED'

export class WorkforceToolDispatchError extends Error {
  constructor(readonly code: WorkforceToolDispatchErrorCode) {
    super(code)
    this.name = 'WorkforceToolDispatchError'
  }
}

export interface WorkforceToolDescriptor {
  id: string
  description: string
  audience: readonly WorkforceToolAudience[]
  scope: WorkforceToolScope
  operation: 'READ'
  permission: string
  permissions: readonly string[]
  module: string
  inputSchema: Record<string, unknown>
}

export function listWorkforceToolDescriptors(): WorkforceToolDescriptor[] {
  return WORKFORCE_TOOL_CATALOG.map((tool) => ({
    id: tool.id,
    description: tool.description,
    audience: tool.audience,
    scope: tool.scope,
    operation: tool.operation,
    permission: tool.permission,
    permissions: [tool.permission, ...(tool.additionalPermissions ?? [])],
    module: tool.module,
    inputSchema: z.toJSONSchema(tool.inputSchema),
  }))
}

const workforceWebMcpClientDescriptorSchema = z.object({
  id: z.string(),
  description: z.string(),
  operation: z.literal('READ'),
  inputSchema: z.record(z.string(), z.unknown()),
}).strict()

type WorkforceWebMcpClientDescriptor = z.infer<typeof workforceWebMcpClientDescriptorSchema>

/** Rebuilds the public browser descriptors as validated plain JSON data. */
export function toWorkforceWebMcpClientDescriptors(
  descriptors: readonly WorkforceToolDescriptor[],
): WorkforceWebMcpClientDescriptor[] {
  const projected = descriptors.map(({ id, description, operation, inputSchema }) => ({
    id,
    description,
    operation,
    inputSchema,
  }))
  const serialized = JSON.stringify(projected)
  const plainDescriptors: unknown = serialized === undefined ? null : JSON.parse(serialized)
  return z.array(workforceWebMcpClientDescriptorSchema).parse(plainDescriptors)
}

function errorStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) return null
  const status = (error as Record<string, unknown>).status
  return typeof status === 'number' ? status : null
}

export function resolveWorkforceToolAudience(activeRoles: readonly string[]): WorkforceToolAudience | null {
  if (activeRoles.some((role) => role.includes('HR') || role === 'TENANT_ADMIN')) return 'HR'
  if (activeRoles.includes('DIRECT_MANAGER')) return 'MANAGER'
  if (activeRoles.includes('EMPLOYEE')) return 'EMPLOYEE'
  return null
}

async function authorizeWorkforceTool(tool: WorkforceToolDefinition): Promise<void> {
  const context = await requireAuthContext()
  const audience = resolveWorkforceToolAudience(context.activeRoles)
  if (!audience || !tool.audience.includes(audience)) throw new WorkforceToolDispatchError('ACCESS_DENIED')

  if (tool.scope === 'SELF' && (audience !== 'EMPLOYEE' || !context.employeeId)) {
    throw new WorkforceToolDispatchError('ACCESS_DENIED')
  }
  if (tool.scope === 'MANAGER_SCOPE' && (audience !== 'MANAGER' || context.permissions.includes('talent:manage'))) {
    throw new WorkforceToolDispatchError('ACCESS_DENIED')
  }
  if (tool.scope === 'TENANT' && audience !== 'HR') {
    throw new WorkforceToolDispatchError('ACCESS_DENIED')
  }

  const targetEmployeeId = tool.scope === 'SELF' ? context.employeeId ?? undefined : undefined
  for (const permission of [tool.permission, ...(tool.additionalPermissions ?? [])]) {
    await requirePermission(permission, targetEmployeeId)
  }
  await requireTenantModule(tool.module)
}

function mapExecutionError(error: unknown): WorkforceToolDispatchError {
  if (error instanceof ZodError) return new WorkforceToolDispatchError('RESULT_INVALID')
  if (error instanceof ModuleError && error.status === 404) return new WorkforceToolDispatchError('MODULE_INACTIVE')
  if (error instanceof ContextSelectionRequiredError) return new WorkforceToolDispatchError('CONTEXT_SELECTION_REQUIRED')
  const status = errorStatus(error)
  if (status === 401) return new WorkforceToolDispatchError('AUTHENTICATION_REQUIRED')
  if (status === 403) return new WorkforceToolDispatchError('ACCESS_DENIED')
  if (status === 404) return new WorkforceToolDispatchError('RESOURCE_NOT_FOUND')
  return new WorkforceToolDispatchError('EXECUTION_FAILED')
}

export async function dispatchWorkforceTool(toolId: string, rawInput: unknown): Promise<unknown> {
  const tool = getWorkforceTool(toolId)
  if (!tool) throw new WorkforceToolDispatchError('TOOL_NOT_FOUND')

  const parsedInput = tool.inputSchema.safeParse(rawInput)
  if (!parsedInput.success) throw new WorkforceToolDispatchError('INPUT_INVALID')

  try {
    await authorizeWorkforceTool(tool)
    return await tool.execute(parsedInput.data)
  } catch (error) {
    if (error instanceof WorkforceToolDispatchError) throw error
    throw mapExecutionError(error)
  }
}

export async function dispatchHeRaWorkforceTool(name: string, rawInput: unknown): Promise<unknown> {
  const tool = getWorkforceToolByHeRaName(name)
  if (!tool) throw new WorkforceToolDispatchError('TOOL_NOT_FOUND')
  return dispatchWorkforceTool(tool.id, rawInput)
}

export function isHeRaWorkforceToolName(name: string): boolean {
  return getWorkforceToolByHeRaName(name) !== undefined
}

export function assertWorkforceToolCatalogIsValid(): void {
  const ids = WORKFORCE_TOOL_CATALOG.map((tool) => tool.id)
  if (new Set(ids).size !== ids.length) throw new Error('WORKFORCE_TOOL_ID_DUPLICATE')
  const heRaNames = WORKFORCE_TOOL_CATALOG.map((tool) => getWorkforceToolByHeRaNameForDefinition(tool))
  if (new Set(heRaNames).size !== heRaNames.length) throw new Error('WORKFORCE_TOOL_HERA_NAME_DUPLICATE')
}

function getWorkforceToolByHeRaNameForDefinition(tool: WorkforceToolDefinition): string {
  return `workforce_${tool.id.replace(/[^a-zA-Z0-9]+/g, '_').replace(/_+$/g, '')}`
}
