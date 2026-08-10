export interface ResearchAccessInput {
  employeeId: string | null
  permissions: readonly string[]
}

export interface ResearchAccess {
  canOpenHub: boolean
  canManage: boolean
  canMonitor: boolean
  canReadResults: boolean
}

export function resolveResearchAccess(input: ResearchAccessInput): ResearchAccess {
  const permissions = new Set(input.permissions)
  const canManage = permissions.has('research:write')
  const canMonitor = permissions.has('research:read')
  const canReadResults = permissions.has('research-result:read')
  return {
    canOpenHub: input.employeeId !== null || canManage || canMonitor || canReadResults,
    canManage,
    canMonitor,
    canReadResults,
  }
}
