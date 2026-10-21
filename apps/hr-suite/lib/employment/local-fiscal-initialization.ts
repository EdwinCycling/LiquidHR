import 'server-only'
import { createHash } from 'node:crypto'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { requireLocalFiscalOperator } from '@/lib/employment/local-fiscal-operator'
import { createClient } from '@/lib/supabase/server'
import { confirmEmploymentPayrollTaxProfile, getEmploymentPayrollTaxDossier, getPayrollFiscalAdministrationSettings, EmploymentPayrollTaxProfileError, type EmploymentPayrollTaxDossier } from '@/lib/employment/employment-payroll-tax-profile-service'

export function fiscalInitializationKey(parts: readonly string[]): string {
  const hash = createHash('sha256').update(['PAYTAX-UI-01B-v1', ...parts].join('|')).digest('hex')
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-5${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`
}
function previousDate(date: string): string {
  const value = new Date(date + 'T00:00:00Z')
  value.setUTCDate(value.getUTCDate()-1)
  return value.toISOString().slice(0,10)
}
export type FiscalInitializationItem = {
  employeeId: string
  employmentId: string
  incomeRelationshipId: string | null
  status: string
  profileId?: string
  credit?: boolean
}
export function planFiscalDossier(dossier: EmploymentPayrollTaxDossier) {
  if (dossier.employment.recordStatus !== 'CONFIRMED') return { reason: 'EMPLOYMENT_NOT_CONFIRMED', rows: [] }
  if (!dossier.ageCategory) return { reason: 'AGE_SOURCE_MISSING', rows: [] }
  const rows = dossier.incomeRelationships.filter(row => row.relationshipType === 'EMPLOYMENT'
    && row.reportingStatus !== 'DRAFT' && row.startsOn <= '2026-10-31'
    && (!row.endsOn || row.endsOn >= '2026-10-01')
    && row.validFrom <= '2026-10-31' && (!row.validUntil || row.validUntil > '2026-10-01'))
    .map(row => {
      const effectiveFrom = [dossier.employment.startsOn,row.startsOn,row.validFrom,'2026-10-01'].sort().at(-1)!
      const effectiveTo = [dossier.employment.endsOn,row.endsOn,row.validUntil ? previousDate(row.validUntil) : null,'2026-12-31']
        .filter((date): date is string => date !== null).sort()[0]!
      return { incomeRelationshipId: row.incomeRelationshipId,effectiveFrom,effectiveTo,
        existing: dossier.taxProfiles.some(profile => profile.income_relationship_id===row.incomeRelationshipId),
        supported: effectiveFrom <= '2026-10-01' && effectiveTo >= '2026-10-31' }
    })
  if (!rows.length) return { reason: 'VALID_IKV_LINK_MISSING', rows: [] }
  if (new Set(rows.map(row=>row.incomeRelationshipId)).size !== rows.length) return { reason:'AMBIGUOUS_IKV_LINK',rows:[] }
  return { reason: null, rows }
}
export async function initializeActiveAdministrationFiscalProfiles() {
  await requireLocalFiscalOperator()
  const context = await requirePermission('salary:write')
  if (!context.administrationId || !context.hrGroupId || !context.activeRoles.some(role=>role==='HR_ADMIN'||role==='TENANT_ADMIN')) throw new AuthorizationError('Geen fiscale schrijfbevoegdheid.')
  const roster = await getPayrollFiscalAdministrationSettings()
  if (roster.rows.length >= 2000) throw new Error('FISCAL_ROSTER_INCOMPLETE')
  const client = await createClient()
  const eligible = await client.from('employees').select('id').eq('tenant_id', context.tenantId)
    .eq('hr_group_id', context.hrGroupId).eq('is_active', true).eq('is_archived', false).is('deleted_at', null).limit(2000)
  if (eligible.error || (eligible.data?.length ?? 0) >= 2000) throw new Error('FISCAL_EMPLOYEE_SCOPE_UNAVAILABLE')
  const activeEmployeeIds = new Set(eligible.data?.map(employee => employee.id))
  const items: FiscalInitializationItem[] = []
  const creditAssigned = new Set<string>()
  for (const row of [...roster.rows].sort((a,b)=>a.startsOn.localeCompare(b.startsOn)||a.employmentId.localeCompare(b.employmentId))) {
    const base = {employeeId:row.employeeId,employmentId:row.employmentId,incomeRelationshipId:null}
    if (!activeEmployeeIds.has(row.employeeId)) { items.push({...base,status:'EMPLOYEE_INACTIVE_OR_UNAVAILABLE'}); continue }
    if (row.startsOn>'2026-10-31'||(row.endsOn!==null&&row.endsOn<'2026-10-01')) { items.push({...base,status:'OUTSIDE_OCTOBER_2026'}); continue }
    try {
      const dossier=await getEmploymentPayrollTaxDossier(row.employeeId,row.employmentId)
      const plan=planFiscalDossier(dossier)
      if (plan.reason) { items.push({...base,status:plan.reason});continue }
      if (dossier.taxProfiles.some(profile=>profile.payroll_tax_credit_applies)) creditAssigned.add(row.employeeId)
      for (const profile of plan.rows) {
        const identity={...base,incomeRelationshipId:profile.incomeRelationshipId}
        if(profile.existing){items.push({...identity,status:'EXISTING_PROFILE_PRESERVED'});continue}
        if(!profile.supported){items.push({...identity,status:'PARTIAL_PERIOD_NOT_SUPPORTED'});continue}
        const credit=!creditAssigned.has(row.employeeId)&&parseInt(createHash('sha256').update(row.employeeId).digest('hex').slice(0,2),16)%3!==0
        const key=fiscalInitializationKey([context.tenantId,context.administrationId,row.employmentId,profile.incomeRelationshipId,profile.effectiveFrom,profile.effectiveTo,String(credit)])
        const result=await confirmEmploymentPayrollTaxProfile({
          employeeId:row.employeeId,employmentId:row.employmentId,incomeRelationshipId:profile.incomeRelationshipId,
          effectiveFrom:profile.effectiveFrom,effectiveTo:profile.effectiveTo,payrollTaxCreditApplies:credit,
          sourceClassification:'HR_ADMIN_CONFIRMED',sourceReference:`HR-inrichting loonheffing 2026 / dossier ${key.slice(0,4)}-${key.slice(4,8)}`,idempotencyKey:key,
        })
        const readback=await getEmploymentPayrollTaxDossier(row.employeeId,row.employmentId)
        if(!readback.taxProfiles.some(saved=>saved.id===result.profileId&&saved.source_classification==='HR_ADMIN_CONFIRMED'&&saved.income_relationship_id===profile.incomeRelationshipId&&saved.payroll_tax_credit_applies===credit)) throw new Error('FISCAL_READBACK_FAILED')
        if(credit)creditAssigned.add(row.employeeId)
        items.push({...identity,status:result.reused?'REUSED':'SAVED',profileId:result.profileId,credit})
      }
    }catch(error){
      if(error instanceof AuthorizationError)items.push({...base,status:'WRITE_SCOPE_DENIED'})
      else if(error instanceof EmploymentPayrollTaxProfileError)items.push({...base,status:error.code})
      else throw error
    }
  }
  return {administrationId:context.administrationId,administrationName:roster.administration.name,items}
}
