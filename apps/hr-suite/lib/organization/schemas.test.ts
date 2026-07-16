import { describe, expect, it } from 'vitest'
import {
  departmentCreateSchema,
  managementAssignmentCreateSchema,
  placementCreateSchema,
  roleCreateSchema,
} from './schemas'

const ids = {
  employee: '11111111-1111-4111-8111-111111111111',
  department: '22222222-2222-4222-8222-222222222222',
  role: '33333333-3333-4333-8333-333333333333',
}

describe('organisatiebeheer-validatie', () => {
  it('accepteert een veilige afdeling en tenantrol', () => {
    expect(departmentCreateSchema.safeParse({ code: 'HR_NL', name: 'HR Nederland' }).success).toBe(true)
    expect(roleCreateSchema.safeParse({ code: 'HR_ADVISOR', name: 'HR-adviseur' }).success).toBe(true)
  })

  it('weigert een plaatsing waarbij medewerker eigen manager is', () => {
    expect(placementCreateSchema.safeParse({
      employeeId: ids.employee, departmentId: ids.department,
      directManagerId: ids.employee, effectiveFrom: '2026-07-15',
    }).success).toBe(false)
  })

  it('weigert omgekeerde managementdatums', () => {
    expect(managementAssignmentCreateSchema.safeParse({
      employeeId: ids.employee, departmentId: ids.department, managementRoleId: ids.role,
      effectiveFrom: '2026-08-01', effectiveTo: '2026-07-31',
    }).success).toBe(false)
  })
})
