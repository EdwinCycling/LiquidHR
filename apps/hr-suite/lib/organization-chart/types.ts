export type MatchState = 'normal' | 'match' | 'context' | 'dimmed'
export type OrganizationChartView = 'department' | 'manager' | 'job'

export interface ChartAdministrationSource { id: string; code: string; name: string }
export interface ChartDepartmentSource { id: string; parentId: string | null; code: string; name: string }
export interface ChartEmployeeSource { id: string; firstName: string; birthName: string; avatarUrl: string | null }
export interface ChartPlacementSource {
  id: string
  employeeId: string
  employmentId: string | null
  departmentId: string
  directManagerId: string | null
  jobTitle: string | null
  jobId: string | null
  effectiveFrom: string
  effectiveTo: string | null
}
export interface ChartManagementSource {
  id: string
  departmentId: string
  employeeId: string
  roleCode: string
  roleName: string
  effectiveFrom: string
  effectiveTo: string | null
}
export interface ChartCustomFieldDefinitionSource { id: string; key: string; label: string; fieldType: string }
export interface ChartCustomFieldValueSource { employeeId: string; definitionId: string; displayValue: string }
export interface ChartJobSource { id: string; code: string; name: string; jobGroupId: string | null }
export interface ChartJobGroupSource { id: string; code: string; name: string }
export interface ChartStarPerformerAssessmentSource {
  employeeId: string
  jobId: string | null
  jobGroupId: string | null
  criticalityLevel: number
}

export interface OrganizationChartFilters {
  view: OrganizationChartView
  query?: string
  departmentId?: string
  roleCode?: string
  fieldDefinitionId?: string
  fieldValue?: string
}

export interface OrganizationChartProjectionInput {
  asOfDate: string
  administration: ChartAdministrationSource
  departments: readonly ChartDepartmentSource[]
  employees: readonly ChartEmployeeSource[]
  placements: readonly ChartPlacementSource[]
  managementAssignments: readonly ChartManagementSource[]
  customFieldDefinitions: readonly ChartCustomFieldDefinitionSource[]
  customFieldValues: readonly ChartCustomFieldValueSource[]
  jobs: readonly ChartJobSource[]
  jobGroups: readonly ChartJobGroupSource[]
  starPerformerAssessments: readonly ChartStarPerformerAssessmentSource[]
  filters: OrganizationChartFilters
}

interface ChartNodeBase { id: string; matchState: MatchState }
export interface AdministrationChartNode extends ChartNodeBase {
  type: 'administration'
  administrationId: string
  code: string
  name: string
  employeeCount: number
}
export type DepartmentManager =
  | { status: 'none' }
  | { status: 'resolved' | 'inherited'; employeeId: string; employeeName: string }
  | { status: 'ambiguous'; count: number }
export interface DepartmentChartNode extends ChartNodeBase {
  type: 'department'
  departmentId: string
  parentDepartmentId: string | null
  code: string
  name: string
  employeeCount: number
  manager: DepartmentManager
}
export interface EmployeeChartNode extends ChartNodeBase {
  type: 'employee'
  employeeId: string
  employmentId: string | null
  placementId: string
  departmentId: string
  name: string
  jobTitle: string | null
  avatarUrl: string | null
  badges: { code: string; name: string }[]
  customFields: Record<string, string>
}
export interface GroupChartNode extends ChartNodeBase {
  type: 'group'
  groupId: string
  groupKind: 'manager-root' | 'job-group' | 'job' | 'star-level' | 'ungrouped'
  title: string
  subtitle: string | null
  employeeCount: number
}
export type OrganizationChartNode = AdministrationChartNode | DepartmentChartNode | EmployeeChartNode | GroupChartNode

export interface OrganizationChartEdge {
  id: string
  source: string
  target: string
  matchState: Exclude<MatchState, 'match'>
}

export interface OrganizationChartGraph {
  metadata: {
    asOfDate: string
    administrationId: string
    view: OrganizationChartView
    visiblePrimaryCount: number
    visibleEmployeeCount: number
    matchCount: number
  }
  nodes: OrganizationChartNode[]
  edges: OrganizationChartEdge[]
  filters: {
    departments: { id: string; code: string; name: string }[]
    roles: { code: string; name: string }[]
    customFields: ChartCustomFieldDefinitionSource[]
  }
}
