import { beforeEach,describe,expect,it,vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks=vi.hoisted(()=>({operator:vi.fn(),permission:vi.fn(),initialize:vi.fn(),roster:vi.fn()}))
vi.mock('@/lib/employment/local-fiscal-operator',()=>({requireLocalFiscalOperator:mocks.operator}))
vi.mock('@/lib/auth/permissions',()=>({requirePermission:mocks.permission}))
vi.mock('@/lib/employment/local-fiscal-initialization',()=>({initializeActiveAdministrationFiscalProfiles:mocks.initialize}))
vi.mock('@/lib/employment/employment-payroll-tax-profile-service',()=>({getPayrollFiscalAdministrationSettings:mocks.roster}))
import { POST } from './route'
function request(admin='mars',origin='http://127.0.0.1:3010'){
 return new NextRequest('http://127.0.0.1:3010/api/local/fiscal-initialization',{method:'POST',headers:{host:'127.0.0.1:3010',origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({administrationId:admin})})
}
describe('local fiscal batch boundary',()=>{
 beforeEach(()=>{
  vi.resetAllMocks();vi.stubEnv('NODE_ENV','development');vi.stubEnv('VERCEL','');vi.stubEnv('VERCEL_ENV','');vi.stubEnv('VERCEL_URL','')
  vi.stubEnv('LIQUIDHR_TEST_ROLE_SWITCH_ENABLED','true');vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://wnpfloqpjvaacobppbpk.supabase.co')
  mocks.permission.mockResolvedValue({administrationId:'mars'})
  mocks.initialize.mockResolvedValue({administrationId:'mars',items:[]})
 })
 it('uses the active authorized administration without accepting arbitrary employee inputs',async()=>{
  expect((await POST(request())).status).toBe(200)
  expect(mocks.operator).toHaveBeenCalled()
  expect(mocks.permission).toHaveBeenCalledWith('salary:write')
  expect(mocks.initialize).toHaveBeenCalledWith()
 })
 it('refuses a stale or forged administration before any profile operation',async()=>{
  expect((await POST(request('jupiter'))).status).toBe(403)
  expect(mocks.initialize).not.toHaveBeenCalled()
 })
 it.each(['https://external.example','invalid'])('refuses origin %s',async origin=>{
  expect((await POST(request('mars',origin))).status).toBe(403)
  expect(mocks.operator).not.toHaveBeenCalled()
 })
 it('keeps hosted environments closed',async()=>{
  vi.stubEnv('VERCEL_ENV','preview')
  expect((await POST(request())).status).toBe(404)
  expect(mocks.initialize).not.toHaveBeenCalled()
 })
})
