import 'server-only'

import { createHash } from 'node:crypto'
import type { Json } from '@scope/db'
import { AuthorizationError, getRequestAuthorizationContext, requirePermission } from '@/lib/auth/permissions'
import { createEmployee } from '@/lib/employees/employee-service'
import { createEmployment, EmploymentServiceError, ensureEmployeeAdministrationAssignment } from '@/lib/employment/employment-service'
import { nextAvailableEmploymentNumber } from '@/lib/employment/employment-number'
import { isValidPayrollIkvNumber, PayrollImportError, payrollImportEmploymentLinkId, toSafeDatabaseDate, type CanonicalPayrollAddress, type ExistingPayrollEmployeeCandidate, type PayrollImportAnalysis, type PayrollImportSourceType } from './model'
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

function toPayrollAddressJson(address: CanonicalPayrollAddress | undefined): Json | null {
  if (!address) return null
  const value: { [key: string]: Json | undefined } = {}
  if (address.street !== undefined) value.street = address.street
  if (address.houseNumber !== undefined) value.houseNumber = address.houseNumber
  if (address.houseNumberAddition !== undefined) value.houseNumberAddition = address.houseNumberAddition
  if (address.postalCode !== undefined) value.postalCode = address.postalCode
  if (address.city !== undefined) value.city = address.city
  if (address.countryCode !== undefined) value.countryCode = address.countryCode
  return value
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
      birth_date: toSafeDatabaseDate(row.birthDate),
      gender: row.gender ?? null,
      nationality: row.nationality ?? null,
      address: toPayrollAddressJson(row.address),
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
    starts_on: toSafeDatabaseDate(income.startsOn),
    ends_on: toSafeDatabaseDate(income.endsOn),
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
      if (createError || !created) {
        if (createError?.code !== '23505') throw new PayrollImportError('PAYROLL_INCOME_CREATE_FAILED', 500)
        const { data: conflict, error: conflictError } = await authorization.client
          .from('income_relationships')
          .select('id')
          .eq('tenant_id', authorization.tenantId)
          .eq('administration_id', authorization.administrationId)
          .eq('employee_id', employeeId)
          .eq('payroll_tax_subnumber', payrollTaxSubnumber)
          .eq('ikv_number', income.ikv_number)
          .is('deleted_at', null)
          .maybeSingle()
        if (conflictError || !conflict) throw new PayrollImportError('PAYROLL_INCOME_CREATE_FAILED', 500)
        incomeRelationshipId = conflict.id
      } else {
        incomeRelationshipId = created.id
      }
    }
    const linkEmploymentId = employmentId
    const linkIncomeRelationshipId = incomeRelationshipId
    const linkValidFrom = income.starts_on
    if (linkEmploymentId && linkIncomeRelationshipId && linkValidFrom) {
      const findExactLink = async () => {
        const query = authorization.client
          .from('employment_income_relationships')
          .select('id')
          .eq('tenant_id', authorization.tenantId)
          .eq('administration_id', authorization.administrationId)
          .eq('employee_id', employeeId)
          .eq('employment_id', linkEmploymentId)
          .eq('income_relationship_id', linkIncomeRelationshipId)
          .eq('valid_from', linkValidFrom)
        const exactQuery = income.ends_on ? query.eq('valid_until', income.ends_on) : query.is('valid_until', null)
        const { data, error } = await exactQuery.maybeSingle()
        if (error) throw new PayrollImportError('PAYROLL_EMPLOYMENT_INCOME_LINK_READ_FAILED', 500)
        return data
      }

      const existingLink = await findExactLink()
      if (!existingLink) {
        const { error: linkError } = await authorization.client.from('employment_income_relationships').insert({
          tenant_id: authorization.tenantId,
          administration_id: authorization.administrationId,
          employee_id: employeeId,
          employment_id: linkEmploymentId,
          income_relationship_id: linkIncomeRelationshipId,
          valid_from: linkValidFrom,
          valid_until: income.ends_on,
        })
        if (linkError) {
          const isConcurrentDuplicate = linkError.code === '23505' || linkError.code === '23P01'
          const racedLink = isConcurrentDuplicate ? await findExactLink() : null
          if (!racedLink) {
            const databaseCode = linkError.code && /^[0-9A-Z]{5}$/.test(linkError.code) ? linkError.code : undefined
            throw new PayrollImportError('PAYROLL_EMPLOYMENT_INCOME_LINK_FAILED', 500, databaseCode)
          }
        }
      }
    }
    const { data: updated, error: updateError } = await authorization.client
      .from('payroll_import_income_relationships')
      .update({ status: 'IMPORTED', matched_income_relationship_id: incomeRelationshipId })
      .eq('id', income.id)
      .eq('batch_id', batchId)
      .select('id')
      .maybeSingle()
    if (updateError || !updated) throw new PayrollImportError('PAYROLL_IMPORT_INCOME_UPDATE_FAILED', 500)
    if (income.status !== 'IMPORTED') importedCount += 1
  }
  return importedCount
}

type RecoverablePayrollImportRow = {
  id: string
  rowNumber: number
  firstName: string | null
  birthName: string | null
  missingEmployment: boolean
  pendingIncomeCount: number
}

export type RecoverablePayrollImport = {
  batchId: string
  status: string
  createdAt: string
  rows: RecoverablePayrollImportRow[]
}

async function getRecoverableRows(
  authorization: ImportAuthorization,
  batchId: string,
): Promise<RecoverablePayrollImportRow[]> {
  const { data: rows, error: rowsError } = await authorization.client
    .from('payroll_import_persons')
    .select('id, source_row_number, first_name, birth_name, status, match_status, matched_employee_id')
    .eq('tenant_id', authorization.tenantId)
    .eq('hr_group_id', authorization.hrGroupId)
    .eq('batch_id', batchId)
    .order('source_row_number')
  if (rowsError || !rows) throw new PayrollImportError('PAYROLL_IMPORT_PERSON_READ_FAILED', 500)

  const eligibleRows = rows.filter((row) => row.status !== 'BLOCKING'
    && row.match_status !== 'MANUAL_REVIEW'
    && row.matched_employee_id !== null)
  if (eligibleRows.length === 0) return []

  const personIds = eligibleRows.map((row) => row.id)
  const [employments, incomes] = await Promise.all([
    authorization.client
      .from('employments')
      .select('payroll_import_person_id')
      .eq('tenant_id', authorization.tenantId)
      .eq('hr_group_id', authorization.hrGroupId)
      .in('payroll_import_person_id', personIds),
    authorization.client
      .from('payroll_import_income_relationships')
      .select('import_person_id, ikv_number, starts_on, status')
      .eq('tenant_id', authorization.tenantId)
      .eq('hr_group_id', authorization.hrGroupId)
      .eq('batch_id', batchId)
      .in('import_person_id', personIds)
      .in('status', ['GREEN', 'WARNING', 'IMPORTED']),
  ])
  if (employments.error || !employments.data) throw new PayrollImportError('PAYROLL_IMPORT_EMPLOYMENT_READ_FAILED', 500)
  if (incomes.error || !incomes.data) throw new PayrollImportError('PAYROLL_IMPORT_INCOME_READ_FAILED', 500)

  const employmentPersonIds = new Set(employments.data.flatMap((row) => row.payroll_import_person_id ? [row.payroll_import_person_id] : []))
  const validIncomeCountByPerson = new Map<string, number>()
  const pendingIncomeCountByPerson = new Map<string, number>()
  const invalidIncomePersonIds = new Set<string>()
  for (const income of incomes.data) {
    if (!income.starts_on || !isValidPayrollIkvNumber(income.ikv_number)) {
      invalidIncomePersonIds.add(income.import_person_id)
      continue
    }
    validIncomeCountByPerson.set(income.import_person_id, (validIncomeCountByPerson.get(income.import_person_id) ?? 0) + 1)
    if (income.status !== 'IMPORTED') {
      pendingIncomeCountByPerson.set(income.import_person_id, (pendingIncomeCountByPerson.get(income.import_person_id) ?? 0) + 1)
    }
  }

  return eligibleRows.flatMap((row) => {
    if (invalidIncomePersonIds.has(row.id) || (validIncomeCountByPerson.get(row.id) ?? 0) === 0) return []
    const missingEmployment = !employmentPersonIds.has(row.id)
    const pendingIncomeCount = pendingIncomeCountByPerson.get(row.id) ?? 0
    return missingEmployment || pendingIncomeCount > 0 ? [{
      id: row.id,
      rowNumber: row.source_row_number,
      firstName: row.first_name,
      birthName: row.birth_name,
      missingEmployment,
      pendingIncomeCount,
    }] : []
  })
}

export async function listRecoverablePayrollImports(administrationId: string): Promise<RecoverablePayrollImport[]> {
  const authorization = await requireImportAuthorization(administrationId)
  const { data: batches, error } = await authorization.client
    .from('payroll_import_batches')
    .select('id, status, created_at')
    .eq('tenant_id', authorization.tenantId)
    .eq('hr_group_id', authorization.hrGroupId)
    .eq('administration_id', administrationId)
    .in('status', ['FAILED', 'COMPLETED_WITH_WARNINGS'])
    .not('preview_confirmed_at', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error || !batches) throw new PayrollImportError('PAYROLL_IMPORT_BATCH_READ_FAILED', 500)

  const recoverable = await Promise.all(batches.map(async (batch) => ({
    batchId: batch.id,
    status: batch.status,
    createdAt: batch.created_at,
    rows: await getRecoverableRows(authorization, batch.id),
  })))
  return recoverable.filter((batch) => batch.rows.length > 0)
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
  if (batch.administration_id !== input.administrationId) throw new PayrollImportError('PAYROLL_IMPORT_SCOPE_INVALID', 403)
  if (!input.selectedRowNumbers.length) throw new PayrollImportError('PAYROLL_IMPORT_ROWS_REQUIRED', 422)
  if (batch.status === 'FAILED' && !batch.preview_confirmed_at) throw new PayrollImportError('PAYROLL_IMPORT_BATCH_NOT_FINALIZABLE', 409)
  if (!['STAGED', 'READY', 'FAILED', 'COMPLETED_WITH_WARNINGS'].includes(batch.status)) {
    throw new PayrollImportError('PAYROLL_IMPORT_BATCH_NOT_FINALIZABLE', 409)
  }

  const { data: rows, error: rowsError } = await authorization.client.from('payroll_import_persons').select('*').eq('batch_id', batch.id).order('source_row_number')
  if (rowsError || !rows) throw new PayrollImportError('PAYROLL_IMPORT_PERSON_READ_FAILED', 500)

  const selected = new Set(input.selectedRowNumbers)
  const finalizableRows = rows.filter((row) => selected.has(row.source_row_number)
    && row.status !== 'BLOCKING'
    && row.match_status !== 'MANUAL_REVIEW')
  if (finalizableRows.length === 0) throw new PayrollImportError('PAYROLL_IMPORT_ROWS_REQUIRED', 422)

  const finalizablePersonIds = finalizableRows.map((row) => row.id)
  const { data: selectedIncomeRows, error: selectedIncomeError } = await authorization.client
    .from('payroll_import_income_relationships')
    .select('import_person_id, ikv_number, starts_on, status')
    .eq('tenant_id', authorization.tenantId)
    .eq('hr_group_id', authorization.hrGroupId)
    .eq('batch_id', batch.id)
    .in('import_person_id', finalizablePersonIds)
    .in('status', ['GREEN', 'WARNING', 'IMPORTED'])
  if (selectedIncomeError || !selectedIncomeRows) throw new PayrollImportError('PAYROLL_IMPORT_INCOME_READ_FAILED', 500)
  const selectedIncomeByPerson = new Map<string, typeof selectedIncomeRows>()
  for (const income of selectedIncomeRows) {
    selectedIncomeByPerson.set(income.import_person_id, [...(selectedIncomeByPerson.get(income.import_person_id) ?? []), income])
  }
  const firstStartsOnByPerson = new Map<string, string>()
  for (const row of finalizableRows) {
    const incomes = selectedIncomeByPerson.get(row.id) ?? []
    if (incomes.length === 0 || incomes.some((income) => !income.starts_on || !isValidPayrollIkvNumber(income.ikv_number))) {
      throw new PayrollImportError('PAYROLL_IMPORT_INCOME_INVALID', 422)
    }
    const firstStartsOn = incomes.map((income) => income.starts_on).filter((value): value is string => value !== null).sort()[0]
    if (!firstStartsOn) throw new PayrollImportError('PAYROLL_IMPORT_INCOME_INVALID', 422)
    firstStartsOnByPerson.set(row.id, firstStartsOn)
  }

  if (batch.status === 'FAILED' || batch.status === 'COMPLETED_WITH_WARNINGS') {
    const recoverableRows = await getRecoverableRows(authorization, batch.id)
    const recoverablePersonIds = new Set(recoverableRows.map((row) => row.id))
    if (finalizableRows.some((row) => !recoverablePersonIds.has(row.id))) {
      throw new PayrollImportError('PAYROLL_IMPORT_BATCH_NOT_FINALIZABLE', 409)
    }
  }

  const { data: claimedBatch, error: claimError } = await authorization.client
    .from('payroll_import_batches')
    .update({ status: 'FINALIZING', finalized_at: null })
    .eq('id', batch.id)
    .eq('tenant_id', authorization.tenantId)
    .eq('hr_group_id', authorization.hrGroupId)
    .eq('status', batch.status)
    .select('id')
    .maybeSingle()
  if (claimError || !claimedBatch) throw new PayrollImportError('PAYROLL_IMPORT_BATCH_NOT_FINALIZABLE', 409)

  const warnings: string[] = []
  let employeesImported = 0
  let employmentsCreated = 0
  let incomeRelationshipsImported = 0
  try {
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
          const { error: matchedEmployeeError } = await authorization.client
            .from('payroll_import_persons')
            .update({ matched_employee_id: employeeId, match_status: 'EXACT' })
            .eq('id', row.id)
            .eq('batch_id', batch.id)
          if (matchedEmployeeError) throw new PayrollImportError('PAYROLL_IMPORT_EMPLOYEE_MATCH_UPDATE_FAILED', 500)
          employeesImported += 1
        } catch (error) {
          const category = error instanceof PayrollImportError ? error.code
            : error instanceof EmploymentServiceError ? error.code
              : error instanceof AuthorizationError ? 'AUTHORIZATION_DENIED' : 'UNEXPECTED'
          const databaseCode = error instanceof PayrollImportError || error instanceof EmploymentServiceError ? error.databaseCode ?? null : null
          console.error('[PAYROLL_IMPORT_EMPLOYEE_CREATE_FAILED]', { row: row.source_row_number, category, databaseCode })
          throw new PayrollImportError('PAYROLL_IMPORT_EMPLOYEE_CREATE_FAILED', 500)
        }
      }

      const startsOn = firstStartsOnByPerson.get(row.id)
      if (!startsOn) throw new PayrollImportError('PAYROLL_IMPORT_INCOME_INVALID', 422)

      await ensureEmployeeAdministrationAssignment(employeeId, startsOn, authorization.administrationId)
      const employmentNumberRows = await authorization.client
        .from('employments')
        .select('employment_number')
        .eq('tenant_id', authorization.tenantId)
        .eq('hr_group_id', authorization.hrGroupId)
        .limit(5_000)
      if (employmentNumberRows.error || !employmentNumberRows.data) throw new PayrollImportError('PAYROLL_IMPORT_EMPLOYMENT_READ_FAILED', 500)
      const employment = await createEmployment({
        employeeId,
        employmentNumber: await nextAvailableEmploymentNumber(employmentNumberRows.data.map((item) => item.employment_number)),
        employmentType: 'EMPLOYEE',
        contractType: 'INDEFINITE',
        startsOn,
        seniorityDate: startsOn,
        originalHireDate: startsOn,
        isPrimary: true,
      }, { payrollImportPersonId: row.id })
      if (employment.wasCreated) employmentsCreated += 1
      if (employment.employment.record_status === 'DRAFT') {
        const validationCodes = Array.isArray(row.validation_codes)
          ? row.validation_codes.filter((code): code is string => typeof code === 'string')
          : []
        const { error: warningUpdateError } = await authorization.client
          .from('payroll_import_persons')
          .update({
            status: 'WARNING',
            validation_codes: [...new Set([...validationCodes, 'EMPLOYMENT_DRAFT_REQUIRES_CONTRACT_MAPPING'])],
          })
          .eq('id', row.id)
          .eq('batch_id', batch.id)
        if (warningUpdateError) throw new PayrollImportError('PAYROLL_IMPORT_PERSON_UPDATE_FAILED', 500)
        warnings.push(`ROW_${row.source_row_number}_EMPLOYMENT_DRAFT_REQUIRES_CONTRACT_MAPPING`)
      }
      // A DRAFT lacks the contract mapping needed to decide which income period it owns.
      // Keep each canonical IKV staged/imported, but do not guess a draft-to-IKV link.
      const employmentLinkId = payrollImportEmploymentLinkId({
        employmentId: employment.employment.id,
        recordStatus: employment.employment.record_status,
      })
      incomeRelationshipsImported += await importIncomeRelationships(authorization, employeeId, employmentLinkId, row.id, batch.id)
    }

    const finalStatus = warnings.length > 0 ? 'COMPLETED_WITH_WARNINGS' : 'COMPLETED'
    const { data: completed, error: completeError } = await authorization.client
      .from('payroll_import_batches')
      .update({ status: finalStatus, finalized_at: new Date().toISOString() })
      .eq('id', batch.id)
      .eq('status', 'FINALIZING')
      .select('id')
      .maybeSingle()
    if (completeError || !completed) throw new PayrollImportError('PAYROLL_IMPORT_FINAL_STATUS_UPDATE_FAILED', 500)
    return { batchId: batch.id, employeesImported, employmentsCreated, incomeRelationshipsImported, warnings }
  } catch (error) {
    const category = error instanceof PayrollImportError ? error.code
      : error instanceof EmploymentServiceError ? error.code
        : error instanceof AuthorizationError ? 'AUTHORIZATION_DENIED' : 'UNEXPECTED'
    const databaseCode = error instanceof PayrollImportError || error instanceof EmploymentServiceError ? error.databaseCode ?? null : null
    console.error('[PAYROLL_IMPORT_FINALIZATION_FAILED]', { category, databaseCode })
    const { error: failError } = await authorization.client
      .from('payroll_import_batches')
      .update({ status: 'FAILED', finalized_at: new Date().toISOString() })
      .eq('id', batch.id)
      .eq('status', 'FINALIZING')
    if (failError) console.error('[PAYROLL_IMPORT_FINALIZATION_STATUS_UPDATE_FAILED]', { databaseCode: failError.code ?? null })
    if (error instanceof PayrollImportError) throw error
    throw new PayrollImportError('PAYROLL_IMPORT_FINALIZATION_FAILED', 500)
  }
}
