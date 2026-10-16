import { NextRequest,NextResponse } from 'next/server'
import { requireLocalFiscalOperator } from '@/lib/employment/local-fiscal-operator'
import { initializeActiveAdministrationFiscalProfiles } from '@/lib/employment/local-fiscal-initialization'
import { isLocalPersonaRuntime } from '@/lib/auth/test-role-switch'
import { requirePermission } from '@/lib/auth/permissions'
import { localFiscalRequestOrigin } from '@/lib/employment/local-fiscal-request-origin'
import { getPayrollFiscalAdministrationSettings } from '@/lib/employment/employment-payroll-tax-profile-service'
export async function GET() {
  await requireLocalFiscalOperator()
  const context = await requirePermission('salary:write')
  const roster = await getPayrollFiscalAdministrationSettings()
  return NextResponse.json({userId:context.userId,roles:context.activeRoles,tenantId:context.tenantId,
    hrGroupId:context.hrGroupId,administrationId:context.administrationId,
    salaryWrite:true,confirmedEmployments:roster.rows.length},{headers:{'Cache-Control':'no-store'}})
}
export async function POST(request:NextRequest) {
  const host=request.headers.get('host')
  if(!isLocalPersonaRuntime(host)||!isLocalPersonaRuntime(request.nextUrl.host))return new NextResponse(null,{status:404})
  if(!localFiscalRequestOrigin(host,request.url,request.headers.get('origin')))return new NextResponse(null,{status:403})
  await requireLocalFiscalOperator()
  const form=await request.formData()
  const context=await requirePermission('salary:write')
  if(Array.from(form.keys()).join('|')!=='administrationId'||form.get('administrationId')!==context.administrationId)return new NextResponse(null,{status:403})
  const result=await initializeActiveAdministrationFiscalProfiles()
  return NextResponse.json(result,{headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}})
}
