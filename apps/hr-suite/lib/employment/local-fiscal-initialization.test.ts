import { describe,expect,it,vi } from 'vitest'
vi.mock('server-only',()=>({}))
vi.mock('@/lib/employment/local-fiscal-operator',()=>({requireLocalFiscalOperator:vi.fn()}))
import { fiscalInitializationKey,planFiscalDossier } from './local-fiscal-initialization'
import type { EmploymentPayrollTaxDossier } from './employment-payroll-tax-profile-service'
function dossier(overrides: Partial<EmploymentPayrollTaxDossier>={}): EmploymentPayrollTaxDossier {
 return {employee:{id:'employee',employeeNumber:'100',displayName:'Medewerker'},employment:{id:'employment',number:'1',startsOn:'2020-01-01',endsOn:null,recordStatus:'CONFIRMED',employmentType:null,contractType:null},administration:{id:'admin',name:'Administratie'},incomeRelationships:[{linkId:'link',incomeRelationshipId:'ikv',ikvNumber:1,relationshipType:'EMPLOYMENT',reportingStatus:'READY',startsOn:'2020-01-01',endsOn:null,validFrom:'2020-01-01',validUntil:null}],payrollTaxNumbers:[],schedules:[],taxProfiles:[],auditHistory:[],ageCategory:'UNDER_AOW',...overrides}
}
describe('scoped fiscal initialization plan',()=>{
 it('uses existing valid IKV and bounds registration to the supported fiscal year',()=>{
  expect(planFiscalDossier(dossier()).rows).toEqual([{incomeRelationshipId:'ikv',effectiveFrom:'2026-10-01',effectiveTo:'2026-12-31',existing:false,supported:true}])
 })
 it('does not fabricate links or age sources and rejects ambiguous links',()=>{
  expect(planFiscalDossier(dossier({incomeRelationships:[]})).reason).toBe('VALID_IKV_LINK_MISSING')
  expect(planFiscalDossier(dossier({ageCategory:null})).reason).toBe('AGE_SOURCE_MISSING')
  const base=dossier()
  expect(planFiscalDossier({...base,incomeRelationships:[...base.incomeRelationships,...base.incomeRelationships]}).reason).toBe('AMBIGUOUS_IKV_LINK')
 })
 it('does not treat partial months or draft IKVs as full-month sources',()=>{
  const base=dossier()
  expect(planFiscalDossier({...base,employment:{...base.employment,startsOn:'2026-10-15'}}).rows[0].supported).toBe(false)
  expect(planFiscalDossier({...base,incomeRelationships:[{...base.incomeRelationships[0],reportingStatus:'DRAFT'}]}).rows).toEqual([])
 })
 it('derives stable scope-bound request keys to prevent duplicate versions',()=>{
  expect(fiscalInitializationKey(['tenant','admin','employment','ikv'])).toBe(fiscalInitializationKey(['tenant','admin','employment','ikv']))
  expect(fiscalInitializationKey(['tenant','other-admin','employment','ikv'])).not.toBe(fiscalInitializationKey(['tenant','admin','employment','ikv']))
  expect(fiscalInitializationKey(['x'])).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/)
 })
})
