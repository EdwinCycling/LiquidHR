import { beforeEach,describe,expect,it,vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks=vi.hoisted(()=>({createClient:vi.fn(),signIn:vi.fn(),verified:vi.fn(),clear:vi.fn()}))
vi.mock('@/lib/supabase/server',()=>({createClient:mocks.createClient}))
vi.mock('@/lib/context/context-cookies',()=>({clearActiveContextCookies:mocks.clear}))
vi.mock('@/lib/auth/test-role-switch',async importOriginal=>{
 const actual=await importOriginal<typeof import('@/lib/auth/test-role-switch')>()
 return {...actual,getVerifiedLocalPersonaIdentity:mocks.verified}
})
import { POST } from './route'
function request(origin='http://127.0.0.1:3010',target='hr-admin') {
 return new NextRequest('http://127.0.0.1:3010/api/local/sign-in',{method:'POST',headers:{host:'127.0.0.1:3010',origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({account:target})})
}
describe('fixed local HR Admin password sign-in',()=>{
 beforeEach(()=>{
  vi.resetAllMocks()
  vi.stubEnv('NODE_ENV','development');vi.stubEnv('VERCEL','');vi.stubEnv('VERCEL_ENV','');vi.stubEnv('VERCEL_URL','')
  vi.stubEnv('LIQUIDHR_TEST_ROLE_SWITCH_ENABLED','true');vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://wnpfloqpjvaacobppbpk.supabase.co')
  vi.stubEnv('TALENT_HR_ADMIN_PASSWORD','unit-test-only-credential')
  mocks.createClient.mockResolvedValue({auth:{signInWithPassword:mocks.signIn}})
  mocks.signIn.mockResolvedValue({error:null})
  mocks.verified.mockResolvedValue({userId:'actor',identity:{email:'hradmin.fixture@liquidhr.test',emailVerified:true}})
 })
 it('authenticates only the existing fixed account and verifies its actual claims',async()=>{
  const response=await POST(request())
  expect(response.status).toBe(303)
  expect(mocks.signIn).toHaveBeenCalledWith({email:'hradmin.fixture@liquidhr.test',password:'unit-test-only-credential'})
  expect(mocks.verified).toHaveBeenCalled()
  expect(response.headers.get('location')).toBe('http://127.0.0.1:3010/dashboard/start')
 })
 it.each(['VERCEL','VERCEL_ENV'])('closes hosted environments via %s',async key=>{
  vi.stubEnv(key,'production')
  expect((await POST(request())).status).toBe(404)
  expect(mocks.createClient).not.toHaveBeenCalled()
 })
 it('rejects cross-origin requests and arbitrary account selection before authentication',async()=>{
  expect((await POST(request('https://external.example'))).status).toBe(403)
  expect((await POST(request('http://127.0.0.1:3010','other'))).status).toBe(400)
  expect(mocks.createClient).not.toHaveBeenCalled()
 })
 it('does not turn failed password authentication into a session',async()=>{
  mocks.signIn.mockResolvedValue({error:{code:'invalid_credentials'}})
  expect((await POST(request())).status).toBe(401)
  expect(mocks.verified).not.toHaveBeenCalled()
 })
 it('fails closed without the pre-existing credential',async()=>{
  vi.stubEnv('TALENT_HR_ADMIN_PASSWORD','')
  expect((await POST(request())).status).toBe(503)
  expect(mocks.signIn).not.toHaveBeenCalled()
 })
})
