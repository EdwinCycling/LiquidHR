import { describe, expect, it } from 'vitest'
import {
  ANALYSIS_DATA_PERMISSIONS,
  ANALYSIS_DIMENSIONS,
  ANALYSIS_SEMANTIC_LAYER,
  EMPLOYMENT_STATUS_VALUES,
  findSemanticEntity,
} from './analysis-semantic-layer'

describe('Analysis Semantic Layer V1', () => {
  it('publishes the small, typed workforce capability set', () => {
    const entity = findSemanticEntity('employees')

    expect(entity).toBeDefined()
    expect(entity?.source).toBe('workforce')
    expect(entity?.allowedScope).toBe('HR_GROUP')
    expect(entity?.requiredAnyPermissions).toEqual(ANALYSIS_DATA_PERMISSIONS)
    expect(entity?.measures.map((measure) => measure.key)).toEqual(['headcount'])
    expect(entity?.measures[0]?.aggregation).toBe('count_distinct')
    expect(entity?.dimensions.map((dimension) => dimension.key)).toEqual([...ANALYSIS_DIMENSIONS])
    expect(entity?.presentationCapabilities).toEqual(['kpi', 'table'])
  })

  it('keeps derived employment status values explicit and allowlisted', () => {
    const status = findSemanticEntity('employees')?.dimensions.find((dimension) => dimension.key === 'employment_status')

    expect(status?.dataType).toBe('enum')
    expect(status?.allowedValues).toEqual(EMPLOYMENT_STATUS_VALUES)
    expect(status?.allowedOperators).toEqual(['eq', 'in'])
  })

  it('does not expose a database query surface in the semantic definitions', () => {
    expect(JSON.stringify(ANALYSIS_SEMANTIC_LAYER)).not.toMatch(/select|join|from\s+public|sql/i)
  })
})
