import { beforeEach,describe,expect,it,vi } from 'vitest'
const mocks=vi.hoisted(()=>({requirePermission:vi.fn(),createClient:vi.fn(),encryptPii:vi.fn(),decryptPii:vi.fn(),fingerprint:vi.fn(),eq:vi.fn(),maybeSingle:vi.fn(),insert:vi.fn(),upsert:vi.fn()}))
vi.mock('@/lib/auth/permissions',()=>({requirePermission:mocks.requirePermission,requireHrGroupId:vi.fn()}))
vi.mock('@/lib/supabase/server',()=>({createClient:mocks.createClient}))
vi.mock('@/lib/security/pii-crypto',()=>({encryptPii:mocks.encryptPii,decryptPii:mocks.decryptPii}))
vi.mock('@/lib/security/bsn-fingerprint',()=>({createBsnFingerprint:mocks.fingerprint}))
import { revealEmployeeBsn,setEmployeeBsn } from './employee-service'
describe('secure employee identifier access',()=>{
 beforeEach(()=>{
  vi.resetAllMocks()
  mocks.requirePermission.mockResolvedValue({tenantId:'tenant',userId:'actor'})
  const query={select:vi.fn().mockReturnThis(),eq:mocks.eq,maybeSingle:mocks.maybeSingle}
  mocks.eq.mockReturnValue(query)
  mocks.createClient.mockResolvedValue({from:vi.fn((table:string)=>table==='audit_logs'?{insert:mocks.insert}:table==='employee_secure_identifiers'?{...query,upsert:mocks.upsert}:{})})
  mocks.maybeSingle.mockResolvedValue({data:{bsn_ciphertext:'encrypted'},error:null})
  mocks.insert.mockResolvedValue({error:null})
  mocks.decryptPii.mockReturnValue('masked-unit-value')
 })
 it('reads only the requested employee within the authorized tenant and audits before decrypting',async()=>{
  await expect(revealEmployeeBsn('employee')).resolves.toBe('masked-unit-value')
  expect(mocks.requirePermission).toHaveBeenCalledWith('employee-bsn:read','employee')
  expect(mocks.eq.mock.calls).toEqual([['tenant_id','tenant'],['employee_id','employee']])
  expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({action:'REVEAL',entity_id:'employee',changes:{field:'bsn'}}))
 })
 it('does not decrypt when the audit write fails',async()=>{
  mocks.insert.mockResolvedValue({error:{code:'42501'}})
  await expect(revealEmployeeBsn('employee')).rejects.toThrow('EMPLOYEE_BSN_AUDIT_FAILED')
  expect(mocks.decryptPii).not.toHaveBeenCalled()
 })
 it('rejects invalid input before encryption or persistence',async()=>{
  await expect(setEmployeeBsn('employee','invalid')).rejects.toThrow('BSN_INVALID')
  expect(mocks.encryptPii).not.toHaveBeenCalled()
  expect(mocks.upsert).not.toHaveBeenCalled()
 })
 it('does not read or write identifiers without permission',async()=>{
  mocks.requirePermission.mockRejectedValue(new Error('DENIED'))
  await expect(revealEmployeeBsn('other')).rejects.toThrow('DENIED')
  await expect(setEmployeeBsn('other','invalid')).rejects.toThrow('DENIED')
  expect(mocks.createClient).not.toHaveBeenCalled()
 })
})
