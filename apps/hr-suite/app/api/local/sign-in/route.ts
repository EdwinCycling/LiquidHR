import { NextRequest,NextResponse } from 'next/server'
import { isLocalPersonaRuntime,getVerifiedLocalPersonaIdentity,normalizedEmail } from '@/lib/auth/test-role-switch'
import { localFiscalRequestOrigin } from '@/lib/employment/local-fiscal-request-origin'
import { createClient } from '@/lib/supabase/server'
import { clearActiveContextCookies } from '@/lib/context/context-cookies'
export async function POST(request:NextRequest) {
  if(!isLocalPersonaRuntime(request.headers.get('host'))||!isLocalPersonaRuntime(request.nextUrl.host))return new NextResponse(null,{status:404})
  const origin=localFiscalRequestOrigin(request.headers.get('host'),request.url,request.headers.get('origin'))
  if(!origin)return new NextResponse(null,{status:403})
  const form=await request.formData()
  if(Array.from(form.keys()).join('|')!=='account'||form.get('account')!=='hr-admin')return new NextResponse(null,{status:400})
  const password=process.env.TALENT_HR_ADMIN_PASSWORD
  if(!password)return NextResponse.json({error:'LOCAL_SIGN_IN_UNAVAILABLE',missing:'TALENT_HR_ADMIN_PASSWORD'},{status:503,headers:{'Cache-Control':'no-store'}})
  const client=await createClient()
  const result=await client.auth.signInWithPassword({email:'hradmin.fixture@liquidhr.test',password})
  if(result.error)return NextResponse.json({error:'LOCAL_SIGN_IN_FAILED'},{status:401,headers:{'Cache-Control':'no-store'}})
  const verified=await getVerifiedLocalPersonaIdentity(client)
  if(!verified||!verified.identity.emailVerified||normalizedEmail(verified.identity.email)!=='hradmin.fixture@liquidhr.test')return new NextResponse(null,{status:403})
  const response=NextResponse.redirect(new URL('/dashboard/start',origin),{status:303})
  clearActiveContextCookies(response)
  response.headers.set('Cache-Control','no-store')
  response.headers.set('Referrer-Policy','no-referrer')
  return response
}
