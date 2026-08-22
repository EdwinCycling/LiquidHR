import { describe, expect, it } from 'vitest'
import { buildDepartmentTree, descendantDepartmentIds, filterDepartmentTree, type DepartmentRecord } from './department-tree'

const departments: DepartmentRecord[] = [
  { id: 'root', code: 'ROOT', name: 'Hoofdkantoor', description: null, parentId: null, isActive: true },
  { id: 'child', code: 'CHILD', name: 'People', description: 'HR team', parentId: 'root', isActive: true },
  { id: 'grandchild', code: 'GRAND', name: 'Recruitment', description: null, parentId: 'child', isActive: false },
  { id: 'other', code: 'OTHER', name: 'Operations', description: null, parentId: null, isActive: false },
]

describe('department-tree', () => {
  it('builds parent and child relationships without dropping roots', () => {
    const roots = buildDepartmentTree(departments)

    expect(roots.map((root) => root.id)).toEqual(['root', 'other'])
    expect(roots.find((root) => root.id === 'root')?.children[0]?.id).toBe('child')
    expect(roots.find((root) => root.id === 'root')?.children[0]?.children[0]?.id).toBe('grandchild')
  })

  it('keeps the hierarchy context when a child matches search', () => {
    const result = filterDepartmentTree(departments, 'recruit', 'ALL', 'NAME')

    expect(result.matchingCount).toBe(1)
    expect(result.visibleCount).toBe(3)
    expect(result.roots[0]?.id).toBe('root')
    expect(result.roots[0]?.children[0]?.children[0]?.id).toBe('grandchild')
  })

  it('keeps inactive parents as context for active children', () => {
    const result = filterDepartmentTree([
      { ...departments[0], isActive: false },
      departments[1],
    ], '', 'ACTIVE', 'NAME')

    expect(result.matchingCount).toBe(1)
    expect(result.visibleCount).toBe(2)
    expect(result.roots[0]?.id).toBe('root')
  })

  it('returns all descendants for parent-option protection', () => {
    expect([...descendantDepartmentIds(departments, 'root')].sort()).toEqual(['child', 'grandchild'])
  })
})
