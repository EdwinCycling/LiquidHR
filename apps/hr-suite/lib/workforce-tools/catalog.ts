import type { WorkforceToolDefinition } from './contracts'
import { EMPLOYEE_WORKFORCE_TOOLS } from './employee-tools'
import { HR_WORKFORCE_TOOLS, MANAGER_WORKFORCE_TOOLS } from './manager-tools'

export const WORKFORCE_TOOL_CATALOG = [
  ...EMPLOYEE_WORKFORCE_TOOLS,
  ...MANAGER_WORKFORCE_TOOLS,
  ...HR_WORKFORCE_TOOLS,
] as const satisfies readonly WorkforceToolDefinition[]

const toolsById = new Map<string, WorkforceToolDefinition>(
  WORKFORCE_TOOL_CATALOG.map((tool) => [tool.id, tool]),
)
const toolsByHeRaName = new Map<string, WorkforceToolDefinition>(
  WORKFORCE_TOOL_CATALOG.map((tool) => [workforceToolHeRaName(tool.id), tool]),
)

export function workforceToolHeRaName(toolId: string): string {
  return `workforce_${toolId.replace(/[^a-zA-Z0-9]+/g, '_').replace(/_+$/g, '')}`
}

export function getWorkforceTool(toolId: string): WorkforceToolDefinition | undefined {
  return toolsById.get(toolId)
}

export function getWorkforceToolByHeRaName(name: string): WorkforceToolDefinition | undefined {
  return toolsByHeRaName.get(name)
}
