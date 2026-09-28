import 'server-only'

import { createHash } from 'node:crypto'
import type { Json } from '@scope/db'
import { AuthorizationError, getRequestAuthorizationContext, requirePermission } from '@/lib/auth/permissions'
import { createEmployee } from '@/lib/employees/employee-service'
import { createEmployment, ensureEmployeeAdministrationAssignment } from '@/lib/employment/employment-service'
import { nextAvailableEmploymentNumber } from '@/lib/employment/employment-number'
import { PayrollImportError, type ExistingPayrollEmployeeCandidate, type PayrollImportAnalysis, type PayrollImportSourceType } from './model'
import { adaptPayrollSource } from './source-adapter'
import { toEmployeeCreateInput } from './mapping'
import { validatePayrollPersons } from './validation'
import type { PayrollImportClient } from './database'

type ImportAuthorization = {
  client: PayrollImportClient
  tenantId: string
  hrGroupId: string
  administrationId: string
  userId: string
  payrollTaxNumber: string
}

type PayrollImportBatchInput = {
  sourceType: PayrollImportSourceType
  filename: string
  bytes: Uint8Array
  taxYear: number
  periodStart?: string
  periodEnd?: string
  administrationId: string
}

function asPayrollImportClient(client: Awaited<ReturnType<typeof getRequestAuthorizationContext>>['supabase']): PayrollImportClient {
  return client as unknown as PayrollImportClient
}

function metadataForStorage(metadata: Record<string, string | number | boolean | null>): Json {
  const allowedKeys = new Set(['sourceSystem', 'sourcePath', 'fieldGroup', 'period', 'sourceRow'])
  return Object.fromEntries(Object.entries(metadata).filter(([key]) => allowedKeys.has(key))) as Json
}

async function requireImportAuthorization(administrationId: string): Promise<ImportAuthorization> {
  const requestContext = await getRequestAuthorizationContext()
  if (!requestContext.context.permissions.includes('payroll-import:write')) throw new AuthorizationError('Je hebt geen recht om loonimporten uit te voeren.')
  const hrGroupId = requestContext.context.hrGroupId
  if (!hrGroupId || requestContext.context.administrationId !== administrationId) {
    throw new PayrollImportError('IMPORT_ADMINISTRATION_CONTEXT_REQUIRED', 409)
  }

  const client = asPayrollImportClient(requestContext.supabase)
  const activeOn = new Date().toISOString().slice(0, 10)
  const { data: binding, error: bindingError } = await client
    .from('administration_payroll_tax_numbers')
    .select('payroll_tax_number, valid_from, valid_until')
    .eq('tenant_id', requestContext.context.tenantId)
    .eq('hr_group_id', hrGroupId)
    .eq('administration_id', administrationId)
    .eq('is_primary', true)
    .lte('valid_from', activeOn)
    .or(`valid_until.is.null,valid_until.gte.${activeOn}`)
    .order('valid_from', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (bindingError) {
    if (bindingError.message.toLowerCase().includes('administration_payroll_tax_numbers')) throw new PayrollImportError('CONVERGENCE_REQUIRED', 409)
    throw new PayrollImportError('PAYROLL_TAX_NUMBER_READ_FAILED', 500)
  }
  if (!binding?.payroll_tax_number) throw new PayrollImportError('PAYROLL_TAX_NUMBER_BINDING_REQUIRED', 409)

  return {
    client,
    tenantId: requestContext.context.tenantId,
    hrGroupId,
    administrationId,
    userId: requestContext.context.userId,
    payrollTaxNumber: binding.payroll_tax_number,
  }
}

async function listEmployeeCandidates(
  client: PayrollImportClient,
  tenantId: string,
  hrGroupId: string,
  bsnFingerprints: readonly string[],
): Promise<ExistingPayrollEmployeeCandidate[]> {
  const fingerprintByEmployee = new Map<string, string>()
  for (const bsnFingerprint of [...new Set(bsnFingerprints)]) {
    const { data: matches, error: matchError } = await client.rpc('match_payroll_import_employee_bsn_fingerprint', {
      requested_tenant_id: tenantId,
      requested_hr_group_id: hrGroupId,
      requested_bsn_fingerprint: bsnFingerprint,
    })
    if (matchError) {
      const message = matchError.message.toLowerCase()
      if (message.includes('match_payroll_import_employee_bsn_fingerprint') || (message.includes('function') && message.includes('does not exist'))) {
        throw new PayrollImportError('CONVERGENCE_REQUIRED', 409)
      }
      throw new PayrollImportError('PAYROLL_EMPLOYEE_IDENTITY_MATCH_FAILED', 500)
    }
    for (const match of matches ?? []) fingerprintByEmployee.set(match.employee_id, bsnFingerprint)
  }

  const { data, error } = await client
    .from('employees')
    .select('id, employee_number, first_name, birth_name, birth_date')
    .eq('tenant_id', tenantId)
    .eq('hr_group_id', hrGroupId)
    .is('deleted_at', null)
    .limit(5_000)
  if (error) throw new PayrollImportError('PAYROLL_EMPLOYEE_CANDIDATE_READ_FAILED', 500)
  return data.map((row) => ({
    id: row.id,
    externalEmployeeNumber: row.employee_number,
    bsnFingerprint: fingerprintByEmployee.get(row.id) ?? null,
    firstName: row.first_name,
    birthName: row.birth_name,
    birthDate: row.birth_date,
  }))
}

export async function analyzePayrollImport(input: PayrollImportBatchInput): Promise<PayrollImportAnalysis> {
  const authorization = await requireImportAuthorization(input.administrationId)
  const source = adaptPayrollSource({ sourceType: input.sourceType, bytes: input.bytes })
  const candidates = await listEmployeeCandidates(
    authorization.client,
    authorization.tenantId,
    authorization.hrGroupId,
    source.persons.flatMap((person) => person.bsnFingerprint ? [person.bsnFingerprint] : []),
  )
  return validatePayrollPersons({
    sourceType: source.sourceType,
    sourceFilename: input.filename,
    sourceHash: source.sourceHash,
    persons: source.persons,
    candidates,
    expectedPayrollTaxNumber: authorization.payrollTaxNumber,
  })
}

export async function stagePayrollImport(input: {
  analysis: PayrollImportAnalysis
  taxYear: number
  periodStart?: string
  periodEnd?: string
  administrationId: string
}): Promise<{ batchId: string }> {
  const authorization = await requireImportAuthorization(input.administrationId)
  const idempotencyKey = createHash('sha256')
    .update(`${authorization.tenantId}:${authorization.hrGroupId}:${input.administrationId}:${input.analysis.sourceHash}:${input.taxYear}`, 'utf8')
    .digest('hex')

  const existing = await authorization.client
    .from('payroll_import_batches')
    .select('id')
    .eq('tenant_id', authorization.tenantId)
    .eq('hr_group_id', authorization.hrGroupId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  if (existing.error) throw new PayrollImportError('PAYROLL_IMPORT_BATCH_READ_FAILED', 500)
  if (existing.data) return { batchId: existing.data.id }

  const { data: batch, error: batchError } = await authorization.client
    .from('payroll_import_batches')
    .insert({
      tenant_id: authorization.tenantId,
      hr_group_id: authorization.hrGroupId,
      administration_id: input.administrationId,
      source_type: input.analysis.sourceType,
      source_filename: input.analysis.sourceFilename,
      source_hash: input.analysis.sourceHash,
      tax_year: input.taxYear,
      period_start: input.periodStart ?? null,
      period_end: input.periodEnd ?? null,
      payroll_tax_number: authorization.payrollTaxNumber,
      status: 'STAGED',
      idempotency_key: idempotencyKey,
      created_by_user_id: authorization.userId,
      preview_confirmed_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (batchError || !batch) throw new PayrollImportError('PAYROLL_IMPORT_BATCH_CREATE_FAILED', 500)

  const { data: persons, error: personsError } = await authorization.client
    .from('payroll_import_persons')
    .insert(input.analysis.rows.map((row) => ({
      tenant_id: authorization.tenantId,
      hr_group_id: authorization.hrGroupId,
      batch_id: batch.id,
      source_row_number: row.sourceRowNumber,
      external_employee_number: row.externalEmployeeNumber ?? null,
      bsn_fingerprint: row.bsnFingerprint ?? null,
      initials: row.initials ?? null,
      prefix: row.prefix ?? null,
      first_name: row.firstName ?? null,
      birth_name: row.birthName ?? null,
      birth_date: row.birthDate ?? null,
      gender: row.gender ?? null,
      nationality: row.nationality ?? null,
      address: row.address ?? null,
      status: row.status,
      match_status: row.match.status,
      matched_employee_id: row.match.employeeId ?? null,
      validation_codes: row.issues.map((item) => item.code),
      source_metadata: metadataForStorage(row.sourceMetadata),
    })))
    .select('id, source_row_number')
  if (personsError || !persons) {
    await authorization.client.from('payroll_import_batches').update({ status: 'FAILED' }).eq('id', batch.id)
    throw new PayrollImportError('PAYROLL_IMPORT_PERSON_STAGE_FAILED', 500)
  }

  const personIdsByRow = new Map(persons.map((person) => [person.source_row_number, person.id]))
  const incomeRows = input.analysis.rows.flatMap((row) => row.incomeRelationships.map((income) => ({
    tenant_id: authorization.tenantId,
    hr_group_id: authorization.hrGroupId,
    batch_id: batch.id,
    import_person_id: personIdsByRow.get(row.sourceRowNumber),
    administration_id: input.administrationId,
    payroll_tax_number: income.payrollTaxNumber,
    ikv_number: income.ikvNumber,
    income_code: income.incomeCode ?? null,
    employment_relation_code: income.employmentRelationCode ?? null,
    cao_code: income.caoCode ?? null,
    flags: income.flags,
    hours_per_week: income.hoursPerWeek ?? null,
    salary_amount: income.salaryAmount ?? null,
    starts_on: income.startsOn ?? null,
    ends_on: income.endsOn ?? null,
    status: row.status === 'BLOCKING' ? 'BLOCKING' : row.match.status === 'MANUAL_REVIEW' ? 'MANUAL_REVIEW' : 'GREEN',
    validation_codes: row.issues.map((item) => item.code),
    source_metadata: metadataForStorage(row.sourceMetadata),
  }))).filter((row): row is typeof row & { import_person_id: string } => typeof row.import_person_id === 'string')
  if (incomeRows.length > 0) {
    const { error: incomeError } = await authorization.client.from('payroll_import_income_relationships').insert(incomeRows)
    if (incomeError) {
      await authorization.client.from('payroll_import_batches').update({ status: 'FAILED' }).eq('id', batch.id)
      throw new PayrollImportError('PAYROLL_IMPORT_INCOME_STAGE_FAILED', 500)
    }
  }

  return { batchId: batch.id }
}

async function importIncomeRelationships(
  authorization: ImportAuthorization,
  employeeId: string,
  employmentId: string | null,
  personId: string,
  batchId: string,
): Promise<number> {
  const { data: incomeRows, error: incomeReadError } = await authorization.client
    .from('payroll_import_income_relationships')
    .select('*')
    .eq('batch_id', batchId)
    .eq('import_person_id', personId)
  if (incomeReadError) throw new PayrollImportError('PAYROLL_IMPORT_INCOME_READ_FAILED', 500)
  let importedCount = 0
  for (const income of incomeRows) {
    if (income.status === 'BLOCKING' || income.status === 'MANUAL_REVIEW' || !income.starts_on) continue
    const payrollTaxSubnumber = income.payroll_tax_number.slice(-2)
    const existing = await authorization.client
      .from('income_relationships')
      .select('id')
      .eq('tenant_id', authorization.tenantId)
      .eq('administration_id', authorization.administrationId)
      .eq('employee_id', employeeId)
      .eq('payroll_tax_subnumber', payrollTaxSubnumber)
      .eq('ikv_number', income.ikv_number)
      .is('deleted_at', null)
      .maybeSingle()
    if (existing.error) throw new PayrollImportError('PAYROLL_INCOME_READ_FAILED', 500)
    let incomeRelationshipId = existing.data?.id ?? null
    if (!incomeRelationshipId) {
      await requirePermission('salary:write', employeeId)
      const { data: created, error: createError } = await authorization.client
        .from('income_relationships')
        .insert({
          tenant_id: authorization.tenantId,
          administration_id: authorization.administrationId,
          employee_id: employeeId,
          payroll_tax_subnumber: payrollTaxSubnumber,
          ikv_number: income.ikv_number,
          relationship_type: 'EMPLOYMENT',
          starts_on: income.starts_on,
          ends_on: income.ends_on,
          reporting_status: 'DRAFT',
        })
        .select('id')
        .single()
      if (createError || !created) continue
      incomeRelationshipId = created.id
    }
    if (employmentId && incomeRelationshipId) {
      const { error: linkError } = await authorization.client.from('employment_income_relationships').insert({
        tenant_id: authorization.tenantId,
        administration_id: authorization.administrationId,
        employee_id: employeeId,
        employment_id: employmentId,
        income_relationship_id: incomeRelationshipId,
        valid_from: income.starts_on,
        valid_until: income.ends_on,
      })
      if (linkError && linkError.code !== '23505') continue
    }
    await authorization.client.from('payroll_import_income_relationships').update({ status: 'IMPORTED', matched_income_relationship_id: incomeRelationshipId }).eq('id', income.id)
    importedCount += 1
  }
  return importedCount
}

export async function finalizePayrollImport(input: {
  batchId: string
  administrationId: string
  selectedRowNumbers: number[]
}): Promise<{ batchId: string; employeesImported: number; employmentsCreated: number; incomeRelationshipsImported: number; warnings: string[] }> {
  const authorization = await requireImportAuthorization(input.administrationId)
  const { data: batch, error: batchError } = await authorization.client
    .from('payroll_import_batches')
    .select('*')
    .eq('id', input.batchId)
    .eq('tenant_id', authorization.tenantId)
    .eq('hr_group_id', authorization.hrGroupId)
    .maybeSingle()
  if (batchError || !batch) throw new PayrollImportError('PAYROLL_IMPORT_BATCH_NOT_FOUND', 404)
  if (!['STAGED', 'READY'].includes(batch.status)) throw new PayrollImportError('PAYROLL_IMPORT_BATCH_NOT_FINALIZABLE', 409)
  if (batch.administration_id !== input.administrationId) throw new PayrollImportError('PAYROLL_IMPORT_SCOPE_INVALID', 403)

  await authorization.client.from('payroll_import_batches').update({ status: 'FINALIZING' }).eq('id', batch.id)
  const { data: rows, error: rowsError } = await authorization.client.from('payroll_import_persons').select('*').eq('batch_id', batch.id).order('source_row_number')
  if (rowsError || !rows) throw new PayrollImportError('PAYROLL_IMPORT_PERSON_READ_FAILED', 500)

  const selected = new Set(input.selectedRowNumbers)
  const warnings: string[] = []
  let employeesImported = 0
  let employmentsCreated = 0
  let incomeRelationshipsImported = 0
  for (const row of rows) {
    const selectedRow = selected.has(row.source_row_number)
    const finalizable = row.status !== 'BLOCKING' && row.match_status !== 'MANUAL_REVIEW' && selectedRow
    if (!finalizable) {
      if (row.status === 'BLOCKING' || row.match_status === 'MANUAL_REVIEW') warnings.push(`ROW_${row.source_row_number}_REVIEW_REQUIRED`)
      continue
    }

    let employeeId = row.matched_employee_id
    if (!employeeId) {
      const inputForEmployee = toEmployeeCreateInput({
        sourceRowNumber: row.source_row_number,
        externalEmployeeNumber: row.external_employee_number ?? undefined,
        bsnFingerprint: row.bsn_fingerprint ?? undefined,
        initials: row.initials ?? undefined,
        prefix: row.prefix ?? undefined,
        firstName: row.first_name ?? undefined,
        birthName: row.birth_name ?? undefined,
        birthDate: row.birth_date ?? undefined,
        gender: row.gender === 'MALE' || row.gender === 'FEMALE' || row.gender === 'OTHER' || row.gender === 'PREFER_NOT_TO_SAY' ? row.gender : undefined,
        nationality: row.nationality ?? undefined,
        incomeRelationships: [],
        sourceMetadata: {},
      })
      if (!inputForEmployee) {
        warnings.push(`ROW_${row.source_row_number}_FIRST_NAME_REQUIRED`)
        continue
      }
      try {
        const created = await createEmployee(inputForEmployee)
        employeeId = created.id
        employeesImported += 1
        await authorization.client.from('payroll_import_persons').update({ matched_employee_id: employeeId, match_status: 'EXACT' }).eq('id', row.id)
      } catch {
        warnings.push(`ROW_${row.source_row_number}_EMPLOYEE_CREATE_FAILED`)
        continue
      }
    }

    let employmentId: string | null = null
    const firstIncome = await authorization.client.from('payroll_import_income_relationships').select('starts_on').eq('import_person_id', row.id).order('starts_on').limit(1).maybeSingle()
    const startsOn = firstIncome.data?.starts_on ?? new Date().toISOString().slice(0, 10)
    try {
      await ensureEmployeeAdministrationAssignment(employeeId, startsOn, authorization.administrationId)
      const employment = await createEmployment({
        employeeId,
        employmentNumber: await nextAvailableEmploymentNumber((await authorization.client.from('employments').select('employment_number').eq('tenant_id', authorization.tenantId).eq('hr_group_id', authorization.hrGroupId).limit(5_000)).data?.map((item) => item.employment_number) ?? []),
        employmentType: 'EMPLOYEE',
        contractType: 'INDEFINITE',
        startsOn,
        seniorityDate: startsOn,
        originalHireDate: startsOn,
        isPrimary: true,
      })
      employmentId = employment.employment.id
      employmentsCreated += 1
      warnings.push(`ROW_${row.source_row_number}_EMPLOYMENT_DRAFT_REQUIRES_CONTRACT_MAPPING`)
    } catch {
      warnings.push(`ROW_${row.source_row_number}_EMPLOYMENT_CREATE_FAILED`)
    }
    incomeRelationshipsImported += await importIncomeRelationships(authorization, employeeId, employmentId, row.id, batch.id)
  }

  const finalStatus = warnings.length > 0 ? 'COMPLETED_WITH_WARNINGS' : 'COMPLETED'
  await authorization.client.from('payroll_import_batches').update({ status: finalStatus, finalized_at: new Date().toISOString() }).eq('id', batch.id)
  return { batchId: batch.id, employeesImported, employmentsCreated, incomeRelationshipsImported, warnings }
}
