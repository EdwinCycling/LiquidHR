import 'server-only'

import type { Database, Json } from '@scope/db'
import { requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { evaluateIncomeRelationshipReadiness, type IncomeRelationshipReadinessBlocker } from './income-relationship-readiness'

type Tables = Database['public']['Tables']
type ReportingStatus = Database['public']['Enums']['payroll_reporting_status']
type IncomeRelationshipAuditRow = Pick<Tables['audit_logs']['Row'], 'id' | 'entity_id' | 'action' | 'changes' | 'created_at'>

export class IncomeRelationshipReadinessError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code)
    this.name = 'IncomeRelationshipReadinessError'
  }
}

export type IncomeRelationshipReadinessRecord = {
  readonly id: string
  readonly ikvNumber: number
  readonly payrollTaxNumber: string | null
  readonly payrollTaxSubnumber: string
  readonly payrollTaxBindingId: string | null
  readonly relationshipType: string
  readonly reportingStatus: ReportingStatus
  readonly startsOn: string
  readonly endsOn: string | null
  readonly linkedEmployments: readonly {
    readonly employmentNumber: string
    readonly validFrom: string
    readonly validUntil: string | null
  }[]
  readonly blockers: readonly IncomeRelationshipReadinessBlocker[]
  readonly canMarkReady: boolean
  readonly payrollTaxNumberOptions: readonly {
    readonly id: string
    readonly payrollTaxNumber: string
    readonly payrollTaxSubnumber: string
    readonly validFrom: string
    readonly validUntil: string | null
    readonly canMarkReady: boolean
    readonly blockers: readonly IncomeRelationshipReadinessBlocker[]
  }[]
  readonly fiscalProfilePresent: boolean
  readonly auditHistory: readonly {
    readonly id: string
    readonly action: string
    readonly createdAt: string
    readonly beforeStatus: string | null
    readonly afterStatus: string | null
  }[]
  readonly auditHistoryAvailable: boolean
}

function isPayrollAdministrator(context: AuthContext): boolean {
  return context.activeRoles.includes('HR_ADMIN') || context.activeRoles.includes('TENANT_ADMIN')
}

function serviceError(message: string): never {
  throw new IncomeRelationshipReadinessError(message, 503)
}

function statusFromAudit(changes: Json, side: 'before' | 'after'): string | null {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return null
  const row = changes[side]
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null
  const status = row.reporting_status
  return typeof status === 'string' ? status : null
}

export async function getIncomeRelationshipReadiness(
  employeeId: string,
  employmentId: string,
): Promise<readonly IncomeRelationshipReadinessRecord[]> {
  const [salaryContext, contractContext, employeeContext] = await Promise.all([
    requirePermission('salary:read', employeeId),
    requirePermission('contract:read', employeeId),
    requirePermission('employee:read', employeeId),
  ])
  const administrationId = salaryContext.administrationId
  const hrGroupId = salaryContext.hrGroupId
  if (!administrationId || !hrGroupId || !isPayrollAdministrator(salaryContext)
    || salaryContext.tenantId !== contractContext.tenantId
    || salaryContext.hrGroupId !== contractContext.hrGroupId
    || salaryContext.administrationId !== contractContext.administrationId
    || salaryContext.tenantId !== employeeContext.tenantId
    || salaryContext.hrGroupId !== employeeContext.hrGroupId
    || salaryContext.administrationId !== employeeContext.administrationId) {
    throw new IncomeRelationshipReadinessError('PAYROLL_IKV_FORBIDDEN', 403)
  }

  const supabase = await createClient()
  const [employmentResult, employeeResult, relationshipResult, taxNumberResult, secureIdentifierResult] = await Promise.all([
    supabase.from('employments')
      .select('id, tenant_id, hr_group_id, administration_id, employee_id, employment_number, starts_on, ends_on, record_status, deleted_at')
      .eq('id', employmentId).eq('employee_id', employeeId)
      .eq('tenant_id', salaryContext.tenantId).eq('hr_group_id', hrGroupId)
      .eq('administration_id', administrationId).is('deleted_at', null).maybeSingle(),
    supabase.from('employees').select('id')
      .eq('id', employeeId).eq('tenant_id', salaryContext.tenantId)
      .eq('hr_group_id', hrGroupId).is('deleted_at', null).maybeSingle(),
    supabase.from('income_relationships')
      .select('id, ikv_number, relationship_type, reporting_status, starts_on, ends_on, payroll_tax_subnumber, payroll_tax_number, payroll_tax_binding_id, payroll_tax_binding_hr_group_id')
      .eq('tenant_id', salaryContext.tenantId).eq('administration_id', administrationId)
      .eq('employee_id', employeeId).is('deleted_at', null).order('starts_on').limit(200),
    supabase.from('administration_payroll_tax_numbers')
      .select('id, hr_group_id, administration_id, payroll_tax_number, valid_from, valid_until')
      .eq('tenant_id', salaryContext.tenantId).eq('hr_group_id', hrGroupId)
      .eq('administration_id', administrationId).order('valid_from').limit(200),
    salaryContext.permissions.includes('employee-bsn:read')
      ? supabase.from('employee_secure_identifiers').select('employee_id')
        .eq('tenant_id', salaryContext.tenantId).eq('employee_id', employeeId)
        .not('bsn_fingerprint', 'is', null).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (employmentResult.error || employeeResult.error || relationshipResult.error
    || taxNumberResult.error || secureIdentifierResult.error) {
    serviceError('PAYROLL_IKV_SOURCE_UNAVAILABLE')
  }
  const employment = employmentResult.data
  const employee = employeeResult.data
  if (!employment || !employee) throw new IncomeRelationshipReadinessError('PAYROLL_IKV_EMPLOYMENT_NOT_FOUND', 404)

  const allRelationships = relationshipResult.data ?? []
  if (allRelationships.length === 0) return []
  const relationshipIds = allRelationships.map((relationship) => relationship.id)
  const [linkResult, employmentRowsResult, contractRowsResult, profileResult, auditResult] = await Promise.all([
    supabase.from('employment_income_relationships')
      .select('id, employment_id, income_relationship_id, valid_from, valid_until')
      .eq('tenant_id', salaryContext.tenantId).eq('administration_id', administrationId)
      .eq('employee_id', employeeId).in('income_relationship_id', relationshipIds).order('valid_from').limit(1000),
    supabase.from('employments')
      .select('id, employment_number, starts_on, ends_on, record_status, deleted_at')
      .eq('tenant_id', salaryContext.tenantId).eq('hr_group_id', hrGroupId)
      .eq('administration_id', administrationId).eq('employee_id', employeeId)
      .is('deleted_at', null).limit(500),
    supabase.from('employment_contracts')
      .select('id, employment_id, starts_on, ends_on')
      .eq('tenant_id', salaryContext.tenantId).eq('administration_id', administrationId)
      .eq('employee_id', employeeId).limit(1000),
    supabase.from('employment_payroll_tax_profiles')
      .select('income_relationship_id')
      .eq('tenant_id', salaryContext.tenantId).eq('hr_group_id', hrGroupId)
      .eq('administration_id', administrationId).eq('employee_id', employeeId)
      .eq('employment_id', employmentId).in('income_relationship_id', relationshipIds).limit(500),
    salaryContext.permissions.includes('audit:read')
      ? supabase.from('audit_logs').select('id, entity_id, action, changes, created_at')
        .eq('tenant_id', salaryContext.tenantId).eq('entity_name', 'income_relationship')
        .in('entity_id', relationshipIds).order('created_at', { ascending: false }).limit(500)
      : Promise.resolve({ data: null, error: null }),
  ])
  if (linkResult.error || employmentRowsResult.error || contractRowsResult.error || profileResult.error || auditResult.error) {
    serviceError('PAYROLL_IKV_SOURCE_UNAVAILABLE')
  }

  const links = linkResult.data ?? []
  const employmentRows = employmentRowsResult.data ?? []
  const contracts = contractRowsResult.data ?? []
  const payrollTaxNumbers = taxNumberResult.data ?? []
  const employmentById = new Map(employmentRows.map((row) => [row.id, row]))
  const contractsByEmploymentId = new Map<string, typeof contracts>()
  for (const contract of contracts) {
    const rows = contractsByEmploymentId.get(contract.employment_id) ?? []
    rows.push(contract)
    contractsByEmploymentId.set(contract.employment_id, rows)
  }
  const profileIncomeIds = new Set((profileResult.data ?? []).map((profile) => profile.income_relationship_id))
  const auditByIncomeId = new Map<string, IncomeRelationshipAuditRow[]>()
  for (const audit of auditResult.data ?? []) {
    if (!audit.entity_id) continue
    const rows = auditByIncomeId.get(audit.entity_id) ?? []
    rows.push(audit)
    auditByIncomeId.set(audit.entity_id, rows)
  }
  const hasVerifiedBsn = Boolean(secureIdentifierResult.data?.employee_id)
  const payrollTaxNumberSourceAvailable = true
  const payrollTaxNumberRows = payrollTaxNumbers.map((number) => ({
    id: number.id,
    hrGroupId: number.hr_group_id,
    administrationId: number.administration_id,
    payrollTaxNumber: number.payroll_tax_number,
    validFrom: number.valid_from,
    validUntil: number.valid_until,
  }))

  return allRelationships.flatMap((relationship) => {
    const relationshipLinks = links.filter((link) => link.income_relationship_id === relationship.id)
    const currentEmploymentLinks = relationshipLinks.filter((link) => link.employment_id === employment.id)
    if (currentEmploymentLinks.length === 0) return []

    const readinessInput = {
      reportingStatus: relationship.reporting_status,
      ikvNumber: relationship.ikv_number,
      relationshipType: relationship.relationship_type,
      startsOn: relationship.starts_on,
      endsOn: relationship.ends_on,
      payrollTaxSubnumber: relationship.payroll_tax_subnumber,
      payrollTaxNumber: relationship.payroll_tax_number,
      payrollTaxBindingId: relationship.payroll_tax_binding_id,
      payrollTaxBindingHrGroupId: relationship.payroll_tax_binding_hr_group_id,
      administrationId,
      hrGroupId,
      hasVerifiedBsn,
      payrollTaxNumberSourceAvailable,
      payrollTaxNumbers: payrollTaxNumberRows,
      links: relationshipLinks.map((link) => {
        const linkedEmployment = employmentById.get(link.employment_id)
        return {
          validFrom: link.valid_from,
          validUntil: link.valid_until,
          employment: linkedEmployment ? {
            startsOn: linkedEmployment.starts_on,
            endsOn: linkedEmployment.ends_on,
            recordStatus: linkedEmployment.record_status,
            contracts: (contractsByEmploymentId.get(linkedEmployment.id) ?? []).map((contract) => ({
              startsOn: contract.starts_on,
              endsOn: contract.ends_on,
            })),
          } : null,
        }
      }),
    } as const
    const readiness = evaluateIncomeRelationshipReadiness(readinessInput)
    const payrollTaxNumberOptions = payrollTaxNumbers.map((number) => {
      const candidateReadiness = evaluateIncomeRelationshipReadiness({
        ...readinessInput,
        payrollTaxSubnumber: number.payroll_tax_number.slice(-3),
        payrollTaxNumber: number.payroll_tax_number,
        payrollTaxBindingId: number.id,
        payrollTaxBindingHrGroupId: number.hr_group_id,
      })
      return {
        id: number.id,
        payrollTaxNumber: number.payroll_tax_number,
        payrollTaxSubnumber: number.payroll_tax_number.slice(-3),
        validFrom: number.valid_from,
        validUntil: number.valid_until,
        canMarkReady: candidateReadiness.canMarkReady,
        blockers: candidateReadiness.blockers,
      }
    })
    const auditHistory = (auditByIncomeId.get(relationship.id) ?? []).map((audit) => ({
      id: audit.id,
      action: audit.action,
      createdAt: audit.created_at,
      beforeStatus: statusFromAudit(audit.changes, 'before'),
      afterStatus: statusFromAudit(audit.changes, 'after'),
    }))

    return [{
      id: relationship.id,
      ikvNumber: relationship.ikv_number,
      payrollTaxNumber: relationship.payroll_tax_number,
      payrollTaxSubnumber: relationship.payroll_tax_subnumber,
      payrollTaxBindingId: relationship.payroll_tax_binding_id,
      relationshipType: relationship.relationship_type,
      reportingStatus: relationship.reporting_status,
      startsOn: relationship.starts_on,
      endsOn: relationship.ends_on,
      linkedEmployments: relationshipLinks.flatMap((link) => {
        const linkedEmployment = employmentById.get(link.employment_id)
        return linkedEmployment ? [{
          employmentNumber: linkedEmployment.employment_number,
          validFrom: link.valid_from,
          validUntil: link.valid_until,
        }] : []
      }),
      blockers: readiness.blockers,
      canMarkReady: readiness.canMarkReady,
      payrollTaxNumberOptions,
      fiscalProfilePresent: profileIncomeIds.has(relationship.id),
      auditHistory,
      auditHistoryAvailable: salaryContext.permissions.includes('audit:read'),
    }]
  })
}

export async function markIncomeRelationshipReady(
  employeeId: string,
  employmentId: string,
  incomeRelationshipId: string,
  payrollTaxBindingId: string,
): Promise<void> {
  const writeContext = await requirePermission('salary:write', employeeId)
  if (!writeContext.administrationId || !writeContext.hrGroupId || !isPayrollAdministrator(writeContext)) {
    throw new IncomeRelationshipReadinessError('PAYROLL_IKV_FORBIDDEN', 403)
  }

  const records = await getIncomeRelationshipReadiness(employeeId, employmentId)
  const record = records.find((item) => item.id === incomeRelationshipId)
  if (!record || record.reportingStatus !== 'DRAFT') {
    throw new IncomeRelationshipReadinessError('PAYROLL_IKV_NOT_DRAFT', 409)
  }
  const selectedRegistration = record.payrollTaxNumberOptions.find((option) => option.id === payrollTaxBindingId)
  if (!selectedRegistration?.canMarkReady) {
    throw new IncomeRelationshipReadinessError('PAYROLL_IKV_SOURCE_BLOCKED', 409)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.from('income_relationships')
    .update({
      payroll_tax_subnumber: selectedRegistration.payrollTaxSubnumber,
      payroll_tax_number: selectedRegistration.payrollTaxNumber,
      payroll_tax_binding_hr_group_id: writeContext.hrGroupId,
      payroll_tax_binding_id: selectedRegistration.id,
      reporting_status: 'READY',
    })
    .eq('id', incomeRelationshipId)
    .eq('tenant_id', writeContext.tenantId)
    .eq('administration_id', writeContext.administrationId)
    .eq('employee_id', employeeId)
    .eq('reporting_status', 'DRAFT')
    .is('deleted_at', null)
    .select('id, reporting_status')
    .maybeSingle()
  if (error) {
    throw new IncomeRelationshipReadinessError('PAYROLL_IKV_SOURCE_BLOCKED', 409)
  }
  if (!data) throw new IncomeRelationshipReadinessError('PAYROLL_IKV_NOT_DRAFT', 409)
  if (data.reporting_status !== 'READY') throw new IncomeRelationshipReadinessError('PAYROLL_IKV_SOURCE_BLOCKED', 409)
}
