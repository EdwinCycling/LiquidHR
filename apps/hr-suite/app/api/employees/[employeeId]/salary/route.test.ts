import { describe,expect,it,vi } from 'vitest'
const mocks=vi.hoisted(()=>({summary:vi.fn()}))
vi.mock('@/lib/employment/employment-service',()=>({getEmployeeSalarySummary:mocks.summary,EmploymentServiceError:class extends Error{constructor(code:string,readonly status:number){super(code)}}}))
vi.mock('@/lib/auth/permissions',()=>({permissionErrorResponse:()=>null}))
import { EmploymentServiceError } from '@/lib/employment/employment-service'
import { GET } from './route'
describe('employee salary scoped response',()=>{
 it('reports an inaccessible dossier as not found without exposing salary data',async()=>{
  mocks.summary.mockRejectedValueOnce(new EmploymentServiceError('EMPLOYEE_NOT_FOUND',404))
  const response=await GET(new Request('http://localhost/api/employees/other/salary'),{params:Promise.resolve({employeeId:'other'})})
  expect(response.status).toBe(404)
  expect(await response.json()).toEqual({error:'EMPLOYEE_NOT_FOUND'})
 })
})
