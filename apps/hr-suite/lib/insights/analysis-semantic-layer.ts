import type { EmploymentStatus } from '@/lib/employment/employment-status'

export const ANALYSIS_SEMANTIC_VERSION = 1 as const
export const ANALYSIS_SOURCE = 'workforce' as const
export const ANALYSIS_ENTITY = 'employees' as const
export const ANALYSIS_MEASURE = 'headcount' as const

export const ANALYSIS_DIMENSIONS = ['department', 'job', 'employment_status'] as const
export type AnalysisDimensionKey = typeof ANALYSIS_DIMENSIONS[number]
export type AnalysisSourceKey = typeof ANALYSIS_SOURCE
export type AnalysisEntityKey = typeof ANALYSIS_ENTITY
export type AnalysisMeasureKey = typeof ANALYSIS_MEASURE
export type AnalysisFilterOperator = 'eq' | 'in'
export type AnalysisDataPermission = 'employee:read' | 'employee-directory:read'
export type AnalysisAllowedScope = 'HR_GROUP'
export type AnalysisPresentationCapability = 'kpi' | 'table'

export const EMPLOYMENT_STATUS_VALUES: readonly EmploymentStatus[] = [
  'NEVER_EMPLOYED',
  'FUTURE_EMPLOYEE',
  'ACTIVE_EMPLOYEE',
  'FORMER_EMPLOYEE',
]

export const ANALYSIS_DATA_PERMISSIONS: readonly AnalysisDataPermission[] = [
  'employee:read',
  'employee-directory:read',
]

export type AnalysisRelationshipKey = 'current_department' | 'current_job' | 'employment_history'
export type AnalysisRelationshipTarget = 'departments' | 'jobs' | 'employments'

export interface AnalysisSemanticRelationship {
  readonly key: AnalysisRelationshipKey
  readonly target: AnalysisRelationshipTarget
  readonly cardinality: 'many-to-one' | 'one-to-many'
  readonly scope: AnalysisAllowedScope
}

export interface AnalysisSemanticMeasure {
  readonly key: AnalysisMeasureKey
  readonly dataType: 'integer'
  readonly aggregation: 'count_distinct'
  readonly allowedDimensions: readonly AnalysisDimensionKey[]
  readonly requiredAnyPermissions: readonly AnalysisDataPermission[]
}

export interface AnalysisSemanticDimension {
  readonly key: AnalysisDimensionKey
  readonly dataType: 'string' | 'enum'
  readonly labelKey: string
  readonly allowedOperators: readonly AnalysisFilterOperator[]
  readonly relationship: AnalysisRelationshipKey
  readonly allowedValues?: readonly string[]
}

export interface AnalysisSemanticFilter {
  readonly key: AnalysisDimensionKey
  readonly valueType: 'string' | 'enum'
  readonly allowedOperators: readonly AnalysisFilterOperator[]
  readonly allowedValues?: readonly string[]
}

export interface AnalysisSemanticEntity {
  readonly key: AnalysisEntityKey
  readonly source: AnalysisSourceKey
  readonly labelKey: string
  readonly requiredAnyPermissions: readonly AnalysisDataPermission[]
  readonly allowedScope: AnalysisAllowedScope
  readonly measures: readonly AnalysisSemanticMeasure[]
  readonly dimensions: readonly AnalysisSemanticDimension[]
  readonly filters: readonly AnalysisSemanticFilter[]
  readonly relationships: readonly AnalysisSemanticRelationship[]
  readonly presentationCapabilities: readonly AnalysisPresentationCapability[]
}

export interface AnalysisSemanticLayer {
  readonly version: typeof ANALYSIS_SEMANTIC_VERSION
  readonly entities: readonly AnalysisSemanticEntity[]
}

const employeesEntity: AnalysisSemanticEntity = {
  key: ANALYSIS_ENTITY,
  source: ANALYSIS_SOURCE,
  labelKey: 'insights.analysisSemanticEmployees',
  requiredAnyPermissions: ANALYSIS_DATA_PERMISSIONS,
  allowedScope: 'HR_GROUP',
  measures: [{
    key: ANALYSIS_MEASURE,
    dataType: 'integer',
    aggregation: 'count_distinct',
    allowedDimensions: ANALYSIS_DIMENSIONS,
    requiredAnyPermissions: ANALYSIS_DATA_PERMISSIONS,
  }],
  dimensions: [
    {
      key: 'department',
      dataType: 'string',
      labelKey: 'insights.analysisSemanticDepartment',
      allowedOperators: ['eq', 'in'],
      relationship: 'current_department',
    },
    {
      key: 'job',
      dataType: 'string',
      labelKey: 'insights.analysisSemanticJob',
      allowedOperators: ['eq', 'in'],
      relationship: 'current_job',
    },
    {
      key: 'employment_status',
      dataType: 'enum',
      labelKey: 'insights.analysisSemanticEmploymentStatus',
      allowedOperators: ['eq', 'in'],
      relationship: 'employment_history',
      allowedValues: EMPLOYMENT_STATUS_VALUES,
    },
  ],
  filters: [
    {
      key: 'department',
      valueType: 'string',
      allowedOperators: ['eq', 'in'],
    },
    {
      key: 'job',
      valueType: 'string',
      allowedOperators: ['eq', 'in'],
    },
    {
      key: 'employment_status',
      valueType: 'enum',
      allowedOperators: ['eq', 'in'],
      allowedValues: EMPLOYMENT_STATUS_VALUES,
    },
  ],
  relationships: [
    { key: 'current_department', target: 'departments', cardinality: 'many-to-one', scope: 'HR_GROUP' },
    { key: 'current_job', target: 'jobs', cardinality: 'many-to-one', scope: 'HR_GROUP' },
    { key: 'employment_history', target: 'employments', cardinality: 'one-to-many', scope: 'HR_GROUP' },
  ],
  presentationCapabilities: ['kpi', 'table'],
}

export const ANALYSIS_SEMANTIC_LAYER: AnalysisSemanticLayer = {
  version: ANALYSIS_SEMANTIC_VERSION,
  entities: [employeesEntity],
}

export function findSemanticEntity(key: string): AnalysisSemanticEntity | undefined {
  return ANALYSIS_SEMANTIC_LAYER.entities.find((entity) => entity.key === key)
}

export function findSemanticMeasure(entity: AnalysisSemanticEntity, key: string): AnalysisSemanticMeasure | undefined {
  return entity.measures.find((measure) => measure.key === key)
}

export function findSemanticDimension(entity: AnalysisSemanticEntity, key: string): AnalysisSemanticDimension | undefined {
  return entity.dimensions.find((dimension) => dimension.key === key)
}

export function findSemanticFilter(entity: AnalysisSemanticEntity, key: string): AnalysisSemanticFilter | undefined {
  return entity.filters.find((filter) => filter.key === key)
}
