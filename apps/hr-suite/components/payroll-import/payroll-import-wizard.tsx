'use client'

import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react'
import { ScrollableTabs } from '@/components/patterns/scrollable-tabs'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { RadioGroup } from '@/components/ui/radio-group'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { getPayrollImportFieldPolicy } from '@/lib/payroll-import/finalization/field-conflict-policy'
import type { PayrollFinalizationResultSummary } from '@/lib/payroll-import/finalization/result-summary'

type PublicAnalysis = {
  sourceType: 'LOONAANGIFTE_XML' | 'INTERNAL_REPRESENTATIVE'
  sourceHash?: string
  readiness?: PayrollImportReadinessView
  sourceContext?: {
    status: 'SUPPORTED_READ_ONLY' | 'SOURCE_GAP' | 'REJECTED'
    taxYear?: number
    schemaVersion?: string
    namespaceUri?: string
    payrollTaxNumber?: string
    reportingPeriods: Array<{ startsOn: string; endsOn: string }>
    xsdValidation?: 'VALIDATED'
    diagnostics: Array<{ code: string }>
  }
  rows: Array<{
    sourceRowNumber: number
    externalEmployeeNumber?: string
    initials?: string
    prefix?: string
    firstName?: string
    birthName?: string
    significantSurnamePart?: string
    birthDate?: string
    gender?: string
    nationality?: string
    nationalityCode?: number
    genderCode?: number
    address?: Record<string, string>
    incomeRelationships: Array<{
      payrollTaxNumber: string
      ikvNumber: number
      startsOn?: string
      endsOn?: string
      sourcePeriods?: Array<{ startsOn: string; incomeCode: string; employmentRelationCode?: number; caoCode?: number }>
    }>
    status: 'GREEN' | 'WARNING' | 'BLOCKING'
    match: { status: string; reason?: string; employeeId?: string }
    employeeCandidates?: readonly DecisionEmployeeCandidate[]
    issues: Array<{ code: string; severity: string; field?: string }>
  }>
  summary: { total: number; green: number; warnings: number; blocking: number; incomeRelationships: number; ambiguousMatches: number }
}

type Labels = Record<string, string>
type ReadinessStatus = 'READY' | 'WARNING' | 'BLOCKED' | 'NOT_REQUIRED'
type PayrollImportReadinessView = {
  status: ReadinessStatus
  isReady: boolean
  payrollTaxNumber: string | null
  checks: ReadonlyArray<{ key: string; status: ReadinessStatus; code?: string }>
}
type DecisionEmployeeCandidate = {
  id: string
  employeeNumber?: string
  displayName?: string
  administrationIds?: readonly string[]
}
type FinalizeReport = { employeesImported: number; employmentsCreated: number; incomeRelationshipsImported: number; warnings: string[] }
type RecoverableImport = {
  batchId: string
  status: string
  createdAt: string
  rows: Array<{
    rowNumber: number
    firstName: string | null
    birthName: string | null
    missingEmployment: boolean
    pendingIncomeCount: number
  }>
}

type DecisionEmployeeChoice = 'REUSE_EMPLOYEE' | 'CREATE_EMPLOYEE' | 'UNRESOLVED'
type DecisionEmploymentChoice = 'REUSE_EMPLOYMENT' | 'CREATE_DRAFT_EMPLOYMENT' | 'UNDECIDED'
type DecisionIncomeChoice = 'CREATE' | 'LINK' | 'NO_CHANGE' | 'UNDECIDED'
type DecisionSourceFieldChoice = 'USE_SOURCE' | 'KEEP_CURRENT' | 'MANUAL_REVIEW'
export type PayrollImportDecisionRow = PublicAnalysis['rows'][number]

type PayrollImportDecisionDraft = {
  match: { action: DecisionEmployeeChoice; employeeId?: string; confirmed: boolean }
  incomeRelationships: Record<string, { action: DecisionIncomeChoice; incomeRelationshipId?: string; confirmed: boolean }>
  employments: Record<string, { action: DecisionEmploymentChoice; employmentId?: string; confirmed: boolean }>
  sourceFields: Record<string, DecisionSourceFieldChoice>
}

type PersistedDecisionStatus = 'DRAFT' | 'SAVED' | 'STALE' | 'CONFLICT' | 'BLOCKED'
type DecisionPersistenceRecord = {
  personId: string
  sourceRowNumber: number
  proposedEmployeeId?: string | null
  decision: PayrollImportDecisionDraft | null
  decisionVersion: number
  status: PersistedDecisionStatus
  confirmedAt: string | null
  blockers: readonly string[]
  employeeLabel?: string | null
  employmentLabels?: Readonly<Record<string, string>>
}
type DecisionPlanAction = { type?: string; label?: string; description?: string; sourceRowNumber?: number }
type DecisionPlanResult = {
  status: 'BLOCKED' | 'READY_FOR_REVIEW'
  blockers: readonly string[]
  actions: readonly DecisionPlanAction[]
  summary?: PayrollFinalizationResultSummary
}

type DecisionApiPayload = {
  match: { action: DecisionEmployeeChoice; employeeId?: string; confirmed: boolean }
  incomeRelationshipBySourceRef: Record<string, { action: DecisionIncomeChoice; incomeRelationshipId?: string; confirmed: boolean }>
  employmentByIncomeRelationship: Record<string, { action: DecisionEmploymentChoice; employmentId?: string; confirmed: boolean }>
  sourceFieldDecisions: Record<string, DecisionSourceFieldChoice>
}

export type PayrollImportDecisionWorkspaceProps = {
  labels: Labels
  readOnly: boolean
  rows: readonly PayrollImportDecisionRow[]
  section: 'matches' | 'employment' | 'fields' | 'conflicts' | 'preview'
  batchId?: string | null
}

function decisionLabel(labels: Labels, key: string): string {
  return labels[key] ?? labels.error ?? key
}

function interpolateDecisionLabel(labels: Labels, key: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((result, [name, value]) => result.replaceAll(`{${name}}`, String(value)), decisionLabel(labels, key))
}

function incomeDecisionKey(income: PayrollImportDecisionRow['incomeRelationships'][number]): string {
  return `${income.payrollTaxNumber}:${income.ikvNumber}:${income.startsOn ?? ''}`
}

function sourceRefForIncome(row: PayrollImportDecisionRow, income: PayrollImportDecisionRow['incomeRelationships'][number], index: number): string {
  return `row-${row.sourceRowNumber}:income-${index}:${incomeDecisionKey(income)}`
}

function sourceFieldsForRow(row: PayrollImportDecisionRow): string[] {
  const available: Array<[string, boolean]> = [
    ['firstName', Boolean(row.firstName)],
    ['birthName', Boolean(row.birthName)],
    ['birthDate', Boolean(row.birthDate)],
    ['gender', Boolean(row.gender)],
    ['nationality', Boolean(row.nationality)],
    ['address', Boolean(row.address && Object.keys(row.address).length > 0)],
  ]
  return available.filter(([, present]) => present).map(([field]) => field)
}

function initialDecisionDraft(row: PayrollImportDecisionRow): PayrollImportDecisionDraft {
  const action: DecisionEmployeeChoice = row.match.status === 'EXACT'
    ? 'REUSE_EMPLOYEE'
    : row.match.status === 'PROPOSED'
      ? (row.match.employeeId ? 'REUSE_EMPLOYEE' : 'UNRESOLVED')
    : row.match.status === 'NEW' ? 'CREATE_EMPLOYEE' : 'UNRESOLVED'
  const conflictingFields = new Set(row.issues.map((issue) => issue.field).filter((field): field is string => Boolean(field)))
  return {
    match: { action, ...(row.match.employeeId ? { employeeId: row.match.employeeId } : {}), confirmed: false },
    incomeRelationships: Object.fromEntries(row.incomeRelationships.map((income, index) => [sourceRefForIncome(row, income, index), { action: 'UNDECIDED', confirmed: false }])) as PayrollImportDecisionDraft['incomeRelationships'],
    employments: Object.fromEntries(row.incomeRelationships.map((income, index) => [sourceRefForIncome(row, income, index), { action: 'UNDECIDED', confirmed: false }])) as PayrollImportDecisionDraft['employments'],
    sourceFields: Object.fromEntries(sourceFieldsForRow(row).map((field) => {
      const policy = getPayrollImportFieldPolicy(field)
      const defaultChoice = policy?.persistence === 'PREVIEW_ONLY' || policy?.persistence === 'SHARED_CONTRACT_REQUIRED' || policy?.persistence === 'PROVENANCE_ONLY'
        ? 'KEEP_CURRENT'
        : 'USE_SOURCE'
      return [field, conflictingFields.has(field) ? 'MANUAL_REVIEW' : defaultChoice]
    })) as Record<string, DecisionSourceFieldChoice>,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function decisionEmployeeAction(value: unknown): DecisionEmployeeChoice | undefined {
  return value === 'REUSE_EMPLOYEE' || value === 'CREATE_EMPLOYEE' || value === 'UNRESOLVED' ? value : undefined
}

function decisionEmploymentAction(value: unknown): DecisionEmploymentChoice | undefined {
  return value === 'REUSE_EMPLOYMENT' || value === 'CREATE_DRAFT_EMPLOYMENT' || value === 'UNDECIDED' ? value : undefined
}

function decisionIncomeAction(value: unknown): DecisionIncomeChoice | undefined {
  return value === 'CREATE' || value === 'LINK' || value === 'NO_CHANGE' || value === 'UNDECIDED' ? value : undefined
}

function decisionSourceFieldAction(value: unknown): DecisionSourceFieldChoice | undefined {
  return value === 'USE_SOURCE' || value === 'KEEP_CURRENT' || value === 'MANUAL_REVIEW' ? value : undefined
}

function recordValue(record: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (key in record) return record[key]
  }
  return undefined
}

function stringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {}
  return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
    const stringItem = stringValue(item)
    return stringItem ? [[key, stringItem]] : []
  }))
}

function decisionDraftFromApi(value: unknown, row: PayrollImportDecisionRow): PayrollImportDecisionDraft | null {
  if (!isRecord(value)) return null
  const matchValue = recordValue(value, 'match')
  if (!isRecord(matchValue)) return null
  const matchAction = decisionEmployeeAction(matchValue.action)
  if (!matchAction) return null
  const requestedEmployeeId = stringValue(matchValue.employeeId)
  const employeeIdIsScopedCandidate = requestedEmployeeId !== undefined
    && row.employeeCandidates?.some((candidate) => candidate.id === requestedEmployeeId) === true
  const employeeIdIsExactSourceMatch = requestedEmployeeId !== undefined
    && row.match.status === 'EXACT'
    && row.match.employeeId === requestedEmployeeId

  const initial = initialDecisionDraft(row)
  const incomeValues = recordValue(value, 'incomeRelationshipBySourceRef', 'incomeRelationships')
  const employmentValues = recordValue(value, 'employmentByIncomeRelationship', 'employments')
  const sourceFieldValues = recordValue(value, 'sourceFieldDecisions', 'sourceFields')
  const incomeRelationships = { ...initial.incomeRelationships }
  const employments = { ...initial.employments }
  if (isRecord(incomeValues)) {
    for (const [sourceRef, item] of Object.entries(incomeValues)) {
      if (!isRecord(item)) continue
      const action = decisionIncomeAction(item.action)
      if (!action) continue
      incomeRelationships[sourceRef] = {
        action,
        confirmed: booleanValue(item.confirmed),
        ...(stringValue(item.incomeRelationshipId) ? { incomeRelationshipId: stringValue(item.incomeRelationshipId) } : {}),
      }
    }
  }
  if (isRecord(employmentValues)) {
    for (const [sourceRef, item] of Object.entries(employmentValues)) {
      if (!isRecord(item)) continue
      const action = decisionEmploymentAction(item.action)
      if (!action) continue
      employments[sourceRef] = {
        action,
        confirmed: booleanValue(item.confirmed),
        ...(stringValue(item.employmentId) ? { employmentId: stringValue(item.employmentId) } : {}),
      }
    }
  }
  const sourceFields = { ...initial.sourceFields }
  if (isRecord(sourceFieldValues)) {
    for (const [field, item] of Object.entries(sourceFieldValues)) {
      const action = decisionSourceFieldAction(item)
      if (action) sourceFields[field] = action
    }
  }
  return {
    match: {
      action: matchAction,
      confirmed: booleanValue(matchValue.confirmed),
      ...(requestedEmployeeId && (employeeIdIsScopedCandidate || employeeIdIsExactSourceMatch) ? { employeeId: requestedEmployeeId } : {}),
    },
    incomeRelationships,
    employments,
    sourceFields,
  }
}

function decisionDraftToApi(draft: PayrollImportDecisionDraft): DecisionApiPayload {
  return {
    match: draft.match,
    incomeRelationshipBySourceRef: Object.fromEntries(Object.entries(draft.incomeRelationships).map(([sourceRef, decision]) => [sourceRef, decision])),
    employmentByIncomeRelationship: Object.fromEntries(Object.entries(draft.employments).map(([sourceRef, decision]) => [sourceRef, decision])),
    sourceFieldDecisions: draft.sourceFields,
  }
}

function persistedStatus(value: unknown, hasDecision: boolean): PersistedDecisionStatus {
  if (value === 'STALE' || value === 'CONFLICT' || value === 'BLOCKED') return value
  if (value === 'SAVED' || value === 'CONFIRMED' || value === 'CONFIRMED_CURRENT') return 'SAVED'
  return hasDecision ? 'SAVED' : 'DRAFT'
}

function sourceRowNumberFromRecord(value: Record<string, unknown>): number | undefined {
  const direct = recordValue(value, 'sourceRowNumber', 'source_row_number')
  if (typeof direct === 'number' && Number.isInteger(direct)) return direct
  const sourceRef = stringValue(recordValue(value, 'sourceRef', 'source_person_ref'))
  const match = sourceRef ? /^row-(\d+)/.exec(sourceRef) : null
  return match ? Number(match[1]) : undefined
}

function persistedRecordFromApi(value: unknown, rows: readonly PayrollImportDecisionRow[], fallbackSourceRowNumber?: number): DecisionPersistenceRecord | null {
  if (!isRecord(value)) return null
  const sourceRowNumber = sourceRowNumberFromRecord(value) ?? fallbackSourceRowNumber
  if (sourceRowNumber === undefined || !rows.some((row) => row.sourceRowNumber === sourceRowNumber)) return null
  const personId = stringValue(recordValue(value, 'personId', 'importPersonId', 'import_person_id', 'id'))
  if (!personId) return null
  const row = rows.find((candidate) => candidate.sourceRowNumber === sourceRowNumber)
  if (!row) return null
  const decision = decisionDraftFromApi(recordValue(value, 'decision', 'decisionPayload', 'decision_payload'), row)
  const proposedEmployeeId = stringValue(recordValue(value, 'proposedEmployeeId', 'proposed_employee_id', 'matchedEmployeeId', 'matched_employee_id')) ?? null
  const blockersValue = recordValue(value, 'blockers')
  const blockers = Array.isArray(blockersValue) ? blockersValue.filter((item): item is string => typeof item === 'string') : []
  const confirmedAt = stringValue(recordValue(value, 'confirmedAt', 'confirmed_at', 'lastConfirmedAt')) ?? null
  const decisionVersionValue = recordValue(value, 'decisionVersion', 'decision_version')
  const decisionVersion = typeof decisionVersionValue === 'number' && Number.isInteger(decisionVersionValue) ? decisionVersionValue : 0
  const employeeLabel = stringValue(recordValue(value, 'employeeLabel', 'selectedEmployeeLabel')) ?? null
  const employmentLabels = stringRecord(recordValue(value, 'employmentLabels', 'selectedEmploymentLabels'))
  return {
    personId,
    sourceRowNumber,
    ...(proposedEmployeeId ? { proposedEmployeeId } : {}),
    decision,
    decisionVersion,
    status: persistedStatus(recordValue(value, 'status', 'decisionStatus', 'decision_status'), Boolean(decision)),
    confirmedAt,
    blockers,
    ...(employeeLabel ? { employeeLabel } : {}),
    ...(Object.keys(employmentLabels).length ? { employmentLabels } : {}),
  }
}

function decisionRecordsFromResponse(value: unknown, rows: readonly PayrollImportDecisionRow[]): DecisionPersistenceRecord[] {
  if (!isRecord(value)) return []
  const data = isRecord(value.data) ? value.data : value
  const people = Array.isArray(data.people) ? data.people : []
  const decisions = Array.isArray(data.decisions) ? data.decisions : []
  const decisionByPersonId = new Map<string, unknown>()
  for (const candidate of decisions) {
    if (!isRecord(candidate)) continue
    const personId = stringValue(recordValue(candidate, 'personId', 'importPersonId', 'import_person_id'))
    if (personId) decisionByPersonId.set(personId, candidate)
  }
  if (people.length > 0) {
    return people.flatMap((person) => {
      if (!isRecord(person)) return []
      const personId = stringValue(recordValue(person, 'personId', 'importPersonId', 'import_person_id'))
      const sourceRowNumber = sourceRowNumberFromRecord(person)
      const decision = personId ? decisionByPersonId.get(personId) : undefined
      const merged = { ...person, ...(isRecord(decision) ? decision : {}), ...(decision !== undefined ? { decision: isRecord(decision) ? decision.decision : undefined } : {}) }
      const record = persistedRecordFromApi(merged, rows, sourceRowNumber)
      return record ? [record] : []
    })
  }
  const candidates = recordValue(data, 'decisions', 'records')
  if (!Array.isArray(candidates)) return []
  return candidates.flatMap((candidate) => {
    const record = persistedRecordFromApi(candidate, rows)
    return record ? [record] : []
  })
}

function planResultFromResponse(value: unknown): DecisionPlanResult | null {
  if (!isRecord(value)) return null
  const data = isRecord(value.data) ? value.data : value
  const rawStatus = recordValue(data, 'status', 'planStatus')
  const status = rawStatus === 'READY_FOR_REVIEW' ? 'READY_FOR_REVIEW' : rawStatus === 'BLOCKED' ? 'BLOCKED' : null
  if (!status) return null
  const blockersValue = recordValue(data, 'blockers')
  const blockers = Array.isArray(blockersValue) ? blockersValue.filter((item): item is string => typeof item === 'string') : []
  const actionsValue = recordValue(data, 'actions')
  const peopleValue = recordValue(data, 'people')
  const actions = Array.isArray(actionsValue)
    ? actionsValue.filter(isRecord).map((action) => ({
      ...(stringValue(action.type) ? { type: stringValue(action.type) } : {}),
      ...(stringValue(action.label) ? { label: stringValue(action.label) } : {}),
      ...(stringValue(action.description) ? { description: stringValue(action.description) } : {}),
      ...(typeof action.sourceRowNumber === 'number' ? { sourceRowNumber: action.sourceRowNumber } : {}),
    }))
    : Array.isArray(peopleValue)
      ? peopleValue.filter(isRecord).flatMap((person) => Array.isArray(person.actions) ? person.actions.filter(isRecord).map((action) => ({
        ...(stringValue(action.type) ? { type: stringValue(action.type) } : {}),
        ...(stringValue(action.label) ? { label: stringValue(action.label) } : {}),
        ...(stringValue(action.description) ? { description: stringValue(action.description) } : {}),
      })) : [])
      : []
  const summaryValue = recordValue(data, 'resultSummary')
  const summaryState = isRecord(summaryValue) ? summaryValue.state : null
  const summaryKeys = [
    'peopleTotal', 'peopleNew', 'peopleLinked', 'peopleSkipped', 'peopleNeedsReview', 'peopleProcessed',
    'employmentCreated', 'employmentReused', 'incomeCreatedOrLinked', 'incomeNoChange',
    'actionsCompleted', 'actionsPending', 'actionsFailed', 'actionsBlocked', 'actionsRecovering', 'warnings', 'missingConfirmations',
  ] as const
  const summary = isRecord(summaryValue)
    && ['NOT_STARTED', 'IN_PROGRESS', 'PARTIAL', 'BLOCKED', 'FAILED', 'COMPLETED'].includes(String(summaryState))
    && summaryKeys.every((key) => Number.isSafeInteger(summaryValue[key]) && Number(summaryValue[key]) >= 0)
    ? summaryValue as unknown as PayrollFinalizationResultSummary
    : undefined
  return { status, blockers, actions, ...(summary ? { summary } : {}) }
}

function finalizationSummaryRows(summary: PayrollFinalizationResultSummary): readonly (readonly [string, number])[] {
  return [
    ['finalizationResultPeopleTotal', summary.peopleTotal],
    ['finalizationResultPeopleNew', summary.peopleNew],
    ['finalizationResultPeopleLinked', summary.peopleLinked],
    ['finalizationResultPeopleSkipped', summary.peopleSkipped],
    ['finalizationResultPeopleNeedsReview', summary.peopleNeedsReview],
    ['finalizationResultPeopleProcessed', summary.peopleProcessed],
    ['finalizationResultEmploymentCreated', summary.employmentCreated],
    ['finalizationResultEmploymentReused', summary.employmentReused],
    ['finalizationResultIncomeCreatedOrLinked', summary.incomeCreatedOrLinked],
    ['finalizationResultIncomeNoChange', summary.incomeNoChange],
    ['finalizationResultActionsCompleted', summary.actionsCompleted],
    ['finalizationResultActionsPending', summary.actionsPending],
    ['finalizationResultActionsFailed', summary.actionsFailed],
    ['finalizationResultActionsBlocked', summary.actionsBlocked],
    ['finalizationResultActionsRecovering', summary.actionsRecovering],
    ['finalizationResultWarnings', summary.warnings],
    ['finalizationResultMissingConfirmations', summary.missingConfirmations],
  ] as const
}

export function decisionAnalysisFromResponse(value: unknown): PublicAnalysis | null {
  if (!isRecord(value)) return null
  const data = isRecord(value.data) ? value.data : value
  const sourceType = data.sourceType === 'LOONAANGIFTE_XML' || data.sourceType === 'INTERNAL_REPRESENTATIVE' ? data.sourceType : null
  const people = Array.isArray(data.people) ? data.people : []
  if (!sourceType || people.length === 0) return null
  const rows = people.flatMap((value): PublicAnalysis['rows'] => {
    if (!isRecord(value)) return []
    const sourceRowNumber = recordValue(value, 'sourceRowNumber', 'source_row_number')
    if (typeof sourceRowNumber !== 'number' || !Number.isInteger(sourceRowNumber)) return []
    const statusValue = recordValue(value, 'status')
    const status: PayrollImportDecisionRow['status'] = statusValue === 'GREEN' || statusValue === 'BLOCKING' ? statusValue : 'WARNING'
    const matchStatus = stringValue(recordValue(value, 'matchStatus', 'match_status')) ?? 'UNMATCHED'
    const proposedEmployeeId = stringValue(recordValue(value, 'proposedEmployeeId', 'proposed_employee_id'))
    const employeeCandidates = Array.isArray(value.employeeCandidates) ? value.employeeCandidates.flatMap((candidate): DecisionEmployeeCandidate[] => {
      if (!isRecord(candidate)) return []
      const id = stringValue(recordValue(candidate, 'id'))
      if (!id) return []
      const administrationIds = Array.isArray(candidate.administrationIds)
        ? candidate.administrationIds.filter((item): item is string => typeof item === 'string')
        : []
      return [{
        id,
        ...(stringValue(recordValue(candidate, 'employeeNumber', 'employee_number')) ? { employeeNumber: stringValue(recordValue(candidate, 'employeeNumber', 'employee_number')) } : {}),
        ...(stringValue(recordValue(candidate, 'displayName', 'display_name')) ? { displayName: stringValue(recordValue(candidate, 'displayName', 'display_name')) } : {}),
        ...(administrationIds.length ? { administrationIds } : {}),
      }]
    }) : []
    const issues = Array.isArray(value.issues) ? value.issues.flatMap((issue): PublicAnalysis['rows'][number]['issues'] => {
      if (!isRecord(issue)) return []
      const code = stringValue(recordValue(issue, 'code'))
      if (!code) return []
      const severityValue = stringValue(recordValue(issue, 'severity'))
      return [{ code, severity: severityValue ?? (status === 'BLOCKING' ? 'BLOCKING' : 'WARNING'), ...(stringValue(recordValue(issue, 'field')) ? { field: stringValue(recordValue(issue, 'field')) } : {}) }]
    }) : []
    const incomeRelationships = Array.isArray(value.incomeRelationships) ? value.incomeRelationships.flatMap((income): PublicAnalysis['rows'][number]['incomeRelationships'] => {
      if (!isRecord(income)) return []
      const payrollTaxNumber = stringValue(recordValue(income, 'payrollTaxNumber', 'payroll_tax_number'))
      const ikvNumber = recordValue(income, 'ikvNumber', 'ikv_number')
      if (!payrollTaxNumber || typeof ikvNumber !== 'number' || !Number.isInteger(ikvNumber)) return []
      return [{
        payrollTaxNumber,
        ikvNumber,
        ...(stringValue(recordValue(income, 'startsOn', 'starts_on')) ? { startsOn: stringValue(recordValue(income, 'startsOn', 'starts_on')) } : {}),
        ...(stringValue(recordValue(income, 'endsOn', 'ends_on')) ? { endsOn: stringValue(recordValue(income, 'endsOn', 'ends_on')) } : {}),
      }]
    }) : []
    const match = proposedEmployeeId ? { status: matchStatus, employeeId: proposedEmployeeId } : { status: matchStatus }
    return [{
      sourceRowNumber,
      ...(stringValue(recordValue(value, 'externalEmployeeNumber', 'external_employee_number')) ? { externalEmployeeNumber: stringValue(recordValue(value, 'externalEmployeeNumber', 'external_employee_number')) } : {}),
      ...(stringValue(recordValue(value, 'initials')) ? { initials: stringValue(recordValue(value, 'initials')) } : {}),
      ...(stringValue(recordValue(value, 'prefix')) ? { prefix: stringValue(recordValue(value, 'prefix')) } : {}),
      ...(stringValue(recordValue(value, 'firstName', 'first_name')) ? { firstName: stringValue(recordValue(value, 'firstName', 'first_name')) } : {}),
      ...(stringValue(recordValue(value, 'birthName', 'birth_name')) ? { birthName: stringValue(recordValue(value, 'birthName', 'birth_name')) } : {}),
      ...(stringValue(recordValue(value, 'birthDate', 'birth_date')) ? { birthDate: stringValue(recordValue(value, 'birthDate', 'birth_date')) } : {}),
      ...(stringValue(recordValue(value, 'gender')) ? { gender: stringValue(recordValue(value, 'gender')) } : {}),
      ...(stringValue(recordValue(value, 'nationality')) ? { nationality: stringValue(recordValue(value, 'nationality')) } : {}),
      address: stringRecord(recordValue(value, 'address')),
      incomeRelationships,
      status,
      match,
      ...(employeeCandidates.length ? { employeeCandidates } : {}),
      issues,
    }]
  })
  if (rows.length === 0) return null
  const summary = {
    total: rows.length,
    green: rows.filter((row) => row.status === 'GREEN').length,
    warnings: rows.filter((row) => row.status === 'WARNING').length,
    blocking: rows.filter((row) => row.status === 'BLOCKING').length,
    incomeRelationships: rows.reduce((count, row) => count + row.incomeRelationships.length, 0),
    ambiguousMatches: rows.filter((row) => row.match.status === 'MANUAL_REVIEW').length,
  }
  const periodStart = stringValue(recordValue(data, 'periodStart', 'period_start'))
  const periodEnd = stringValue(recordValue(data, 'periodEnd', 'period_end'))
  const officialSchemaValidated = data.officialSchemaValidated === true
  return {
    sourceType,
    ...(stringValue(recordValue(data, 'sourceHash', 'source_hash')) ? { sourceHash: stringValue(recordValue(data, 'sourceHash', 'source_hash')) } : {}),
    sourceContext: sourceType === 'LOONAANGIFTE_XML' ? {
      status: officialSchemaValidated ? 'SUPPORTED_READ_ONLY' : 'SOURCE_GAP',
      ...(typeof data.taxYear === 'number' ? { taxYear: data.taxYear } : {}),
      ...(stringValue(recordValue(data, 'schemaVersion', 'schema_version')) ? { schemaVersion: stringValue(recordValue(data, 'schemaVersion', 'schema_version')) } : {}),
      ...(stringValue(recordValue(data, 'payrollTaxNumber', 'payroll_tax_number')) ? { payrollTaxNumber: stringValue(recordValue(data, 'payrollTaxNumber', 'payroll_tax_number')) } : {}),
      reportingPeriods: periodStart && periodEnd ? [{ startsOn: periodStart, endsOn: periodEnd }] : [],
      ...(officialSchemaValidated ? { xsdValidation: 'VALIDATED' as const } : {}),
      diagnostics: officialSchemaValidated ? [] : [{ code: 'XML_XSD_UNAVAILABLE' }],
    } : undefined,
    rows,
    summary,
  }
}

function decisionStatusClass(status: PayrollImportDecisionRow['status']): string {
  if (status === 'GREEN') return 'bg-success-subtle text-success'
  if (status === 'WARNING') return 'bg-warning-subtle text-warning'
  return 'bg-destructive-subtle text-destructive'
}

function issueLabel(labels: Labels, code: string): string {
  return decisionLabel(labels, `issue_${code}`)
}

function decisionEmployeeChoiceLabel(labels: Labels, choice: DecisionEmployeeChoice): string {
  return decisionLabel(labels, `decisionEmployee_${choice}`)
}

function decisionEmploymentChoiceLabel(labels: Labels, choice: DecisionEmploymentChoice): string {
  return decisionLabel(labels, `decisionEmployment_${choice}`)
}

function decisionIncomeChoiceLabel(labels: Labels, choice: DecisionIncomeChoice): string {
  return decisionLabel(labels, `decisionIncome_${choice}`)
}

function decisionSourceFieldChoiceLabel(labels: Labels, choice: DecisionSourceFieldChoice): string {
  return decisionLabel(labels, `decisionSourceField_${choice}`)
}

function decisionRowLabel(row: PayrollImportDecisionRow, labels: Labels): string {
  const name = [row.firstName, row.birthName].filter(Boolean).join(' ')
  return `${labels.row} ${row.sourceRowNumber}${name ? ` · ${name}` : ''}`
}

function decisionFieldLabel(labels: Labels, field: string): string {
  return decisionLabel(labels, `decisionField_${field}`)
}

function decisionSourceRefLabel(labels: Labels, sourceRef: string): string {
  return `${labels.decisionSourceRef}: ${sourceRef}`
}

function decisionStatusTone(status: PersistedDecisionStatus): string {
  if (status === 'SAVED') return 'bg-success-subtle text-success'
  if (status === 'STALE' || status === 'CONFLICT') return 'bg-warning-subtle text-warning'
  if (status === 'BLOCKED') return 'bg-destructive-subtle text-destructive'
  return 'bg-surface-subtle text-muted-foreground'
}

function decisionPlanActionLabel(labels: Labels, action: DecisionPlanAction): string {
  if (action.label) return action.label
  if (action.description) return action.description
  return decisionLabel(labels, `decisionAction_${action.type ?? 'UNKNOWN'}`)
}

function decisionIssueFields(row: PayrollImportDecisionRow): string[] {
  return [...new Set(row.issues.map((issue) => issue.field).filter((field): field is string => Boolean(field)))]
}

function decisionDraftIsComplete(row: PayrollImportDecisionRow, draft: PayrollImportDecisionDraft): boolean {
  if (!draft.match.confirmed || draft.match.action === 'UNRESOLVED') return false
  if (row.match.status === 'EXACT' && (draft.match.action !== 'REUSE_EMPLOYEE' || !draft.match.employeeId || draft.match.employeeId !== row.match.employeeId)) return false
  if (row.incomeRelationships.some((income, index) => {
    const sourceRef = sourceRefForIncome(row, income, index)
    const incomeDecision = draft.incomeRelationships[sourceRef]
    const employmentDecision = draft.employments[sourceRef]
    return !incomeDecision || !incomeDecision.confirmed || incomeDecision.action === 'UNDECIDED'
      || !employmentDecision || !employmentDecision.confirmed || employmentDecision.action === 'UNDECIDED'
  })) return false
  return sourceFieldsForRow(row).every((field) => draft.sourceFields[field] && draft.sourceFields[field] !== 'MANUAL_REVIEW')
}

function decisionBlockerCount(row: PayrollImportDecisionRow, draft: PayrollImportDecisionDraft): number {
  let blockers = 0
  if (!draft.match.confirmed || draft.match.action === 'UNRESOLVED') blockers += 1
  if (row.match.status === 'EXACT' && (!draft.match.employeeId || draft.match.employeeId !== row.match.employeeId)) blockers += 1
  blockers += row.incomeRelationships.reduce((count, income, index) => {
    const sourceRef = sourceRefForIncome(row, income, index)
    const incomeDecision = draft.incomeRelationships[sourceRef]
    const employmentDecision = draft.employments[sourceRef]
    return count + (!incomeDecision || !incomeDecision.confirmed || incomeDecision.action === 'UNDECIDED' ? 1 : 0)
      + (!employmentDecision || !employmentDecision.confirmed || employmentDecision.action === 'UNDECIDED' ? 1 : 0)
  }, 0)
  blockers += sourceFieldsForRow(row).filter((field) => !draft.sourceFields[field] || draft.sourceFields[field] === 'MANUAL_REVIEW').length
  return blockers
}

export function DecisionWorkspace({ labels, readOnly, rows, section, batchId = null }: PayrollImportDecisionWorkspaceProps) {
  const [drafts, setDrafts] = useState<Record<number, PayrollImportDecisionDraft>>(() => Object.fromEntries(rows.map((row) => [row.sourceRowNumber, initialDecisionDraft(row)])) as Record<number, PayrollImportDecisionDraft>)
  const [reviewAcknowledged, setReviewAcknowledged] = useState(false)
  const [persisted, setPersisted] = useState<Record<number, DecisionPersistenceRecord>>({})
  const [dirtyRows, setDirtyRows] = useState<ReadonlySet<number>>(new Set())
  const [persistenceLoading, setPersistenceLoading] = useState(false)
  const [persistenceError, setPersistenceError] = useState<string | null>(null)
  const [savingRow, setSavingRow] = useState<number | null>(null)
  const [planPending, setPlanPending] = useState(false)
  const [planResult, setPlanResult] = useState<DecisionPlanResult | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!batchId) {
      void Promise.resolve().then(() => {
        if (cancelled) return
        setPersisted({})
        setDirtyRows(new Set())
        setPersistenceError(null)
      })
      return () => {
        cancelled = true
      }
    }
    void (async () => {
      await Promise.resolve()
      if (cancelled) return
      setPersistenceLoading(true)
      setPersistenceError(null)
      try {
        const response = await fetch(`/api/payroll/import/batches/${encodeURIComponent(batchId)}/decisions`)
        const payload = await response.json() as unknown
        if (!response.ok) throw new Error(isRecord(payload) && typeof payload.error === 'string' ? payload.error : 'DECISION_READ_FAILED')
        if (cancelled) return
        const records = decisionRecordsFromResponse(payload, rows)
        setPersisted(Object.fromEntries(records.map((record) => [record.sourceRowNumber, record])))
        setDrafts((current) => {
          const next = { ...current }
          for (const row of rows) {
            const record = records.find((candidate) => candidate.sourceRowNumber === row.sourceRowNumber)
            if (record?.decision) next[row.sourceRowNumber] = record.decision
            else if (record?.proposedEmployeeId
              && row.employeeCandidates?.some((candidate) => candidate.id === record.proposedEmployeeId)
              && row.match.status !== 'NEW'
              && row.match.status !== 'MANUAL_REVIEW') {
              const initial = initialDecisionDraft(row)
              next[row.sourceRowNumber] = { ...initial, match: { ...initial.match, action: 'REUSE_EMPLOYEE', employeeId: record.proposedEmployeeId, confirmed: false } }
            } else if (!next[row.sourceRowNumber]) next[row.sourceRowNumber] = initialDecisionDraft(row)
          }
          return next
        })
        setDirtyRows(new Set())
      } catch (caught: unknown) {
        if (!cancelled) setPersistenceError(caught instanceof Error ? caught.message : 'DECISION_READ_FAILED')
      } finally {
        if (!cancelled) setPersistenceLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [batchId, rows])

  function updateDraft(row: PayrollImportDecisionRow, update: (draft: PayrollImportDecisionDraft) => PayrollImportDecisionDraft): void {
    setDrafts((current) => {
      const existing = current[row.sourceRowNumber] ?? initialDecisionDraft(row)
      return { ...current, [row.sourceRowNumber]: update(existing) }
    })
    setDirtyRows((current) => new Set(current).add(row.sourceRowNumber))
    setPlanResult(null)
  }

  function setMatch(row: PayrollImportDecisionRow, action: DecisionEmployeeChoice, employeeId?: string): void {
    const authorizedEmployeeIds = new Set(row.employeeCandidates?.map((candidate) => candidate.id) ?? [])
    const candidateEmployeeId = [
      employeeId,
      persisted[row.sourceRowNumber]?.proposedEmployeeId,
      row.match.employeeId,
      row.employeeCandidates?.[0]?.id,
    ].find((candidateId): candidateId is string => Boolean(candidateId && authorizedEmployeeIds.has(candidateId)))
    updateDraft(row, (draft) => ({
      ...draft,
      match: {
        action,
        ...(action === 'REUSE_EMPLOYEE' && candidateEmployeeId ? { employeeId: candidateEmployeeId } : {}),
        confirmed: action !== 'UNRESOLVED',
      },
    }))
  }

  function setIncome(row: PayrollImportDecisionRow, sourceRef: string, action: DecisionIncomeChoice, incomeRelationshipId?: string): void {
    updateDraft(row, (draft) => ({
      ...draft,
      incomeRelationships: {
        ...draft.incomeRelationships,
        [sourceRef]: {
          action,
          confirmed: action !== 'UNDECIDED',
          ...(action === 'LINK' && incomeRelationshipId ? { incomeRelationshipId } : {}),
        },
      },
    }))
  }

  function setEmployment(row: PayrollImportDecisionRow, sourceRef: string, action: DecisionEmploymentChoice, employmentId?: string): void {
    updateDraft(row, (draft) => ({
      ...draft,
      employments: {
        ...draft.employments,
        [sourceRef]: {
          action,
          confirmed: action !== 'UNDECIDED',
          ...(action === 'REUSE_EMPLOYMENT' && employmentId ? { employmentId } : {}),
        },
      },
    }))
  }

  function setField(row: PayrollImportDecisionRow, field: string, action: DecisionSourceFieldChoice): void {
    updateDraft(row, (draft) => ({ ...draft, sourceFields: { ...draft.sourceFields, [field]: action } }))
  }

  async function saveDecision(row: PayrollImportDecisionRow): Promise<void> {
    const record = persisted[row.sourceRowNumber]
    if (!batchId || !record || readOnly || savingRow !== null) return
    const draft = drafts[row.sourceRowNumber] ?? initialDecisionDraft(row)
    setSavingRow(row.sourceRowNumber)
    setPersistenceError(null)
    try {
      const response = await fetch(`/api/payroll/import/batches/${encodeURIComponent(batchId)}/decisions/${encodeURIComponent(record.personId)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision: decisionDraftToApi(draft), expectedDecisionVersion: record.decisionVersion }),
      })
      const payload = await response.json() as unknown
      if (!response.ok) {
        const errorCode = isRecord(payload) && typeof payload.error === 'string' ? payload.error : 'DECISION_SAVE_FAILED'
        if (errorCode === 'DECISION_STALE' || errorCode === 'DECISION_SOURCE_STALE' || errorCode === 'DECISION_CORE_STATE_STALE' || errorCode === 'PAYROLL_IMPORT_DECISION_SOURCE_STALE' || errorCode === 'PAYROLL_IMPORT_DECISION_CORE_STATE_STALE') {
          setPersisted((current) => ({ ...current, [row.sourceRowNumber]: { ...record, status: 'STALE' } }))
        } else if (errorCode === 'DECISION_CONFLICT' || errorCode === 'DECISION_VERSION_CONFLICT' || errorCode === 'PAYROLL_IMPORT_DECISION_VERSION_CONFLICT') {
          setPersisted((current) => ({ ...current, [row.sourceRowNumber]: { ...record, status: 'CONFLICT' } }))
        }
        throw new Error(errorCode)
      }
      const saved = persistedRecordFromApi(isRecord(payload) && 'data' in payload ? payload.data : payload, rows, row.sourceRowNumber)
      if (saved) {
        setPersisted((current) => ({ ...current, [row.sourceRowNumber]: { ...record, ...saved, status: 'SAVED' } }))
        if (saved.decision) setDrafts((current) => ({ ...current, [row.sourceRowNumber]: saved.decision as PayrollImportDecisionDraft }))
      } else {
        setPersisted((current) => ({ ...current, [row.sourceRowNumber]: { ...record, status: 'SAVED', decision: draft, confirmedAt: new Date().toISOString(), blockers: [] } }))
      }
      setDirtyRows((current) => {
        const next = new Set(current)
        next.delete(row.sourceRowNumber)
        return next
      })
      setPlanResult(null)
    } catch (caught: unknown) {
      setPersistenceError(caught instanceof Error ? caught.message : 'DECISION_SAVE_FAILED')
    } finally {
      setSavingRow(null)
    }
  }

  async function requestPlan(): Promise<void> {
    if (!batchId || readOnly || planPending) return
    setPlanPending(true)
    setPersistenceError(null)
    try {
      const response = await fetch(`/api/payroll/import/batches/${encodeURIComponent(batchId)}/plan`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
      const payload = await response.json() as unknown
      if (!response.ok) {
        const errorCode = isRecord(payload) && typeof payload.error === 'string' ? payload.error : 'DECISION_PLAN_FAILED'
        throw new Error(errorCode)
      }
      const result = planResultFromResponse(payload)
      if (!result) throw new Error('DECISION_PLAN_INVALID')
      setPlanResult(result)
    } catch (caught: unknown) {
      setPersistenceError(caught instanceof Error ? caught.message : 'DECISION_PLAN_FAILED')
      setPlanResult(null)
    } finally {
      setPlanPending(false)
    }
  }

  const resolvedRows = rows.filter((row) => drafts[row.sourceRowNumber])
  const completeRows = resolvedRows.filter((row) => decisionDraftIsComplete(row, drafts[row.sourceRowNumber]))
  const blockerCount = resolvedRows.reduce((count, row) => count + decisionBlockerCount(row, drafts[row.sourceRowNumber]), 0)
  const allDecisionsComplete = resolvedRows.length > 0 && completeRows.length === resolvedRows.length && reviewAcknowledged
  const allDecisionsSaved = resolvedRows.length > 0 && resolvedRows.every((row) => {
    const record = persisted[row.sourceRowNumber]
    return Boolean(record && record.status === 'SAVED' && !dirtyRows.has(row.sourceRowNumber))
  })
  const planRequestAllowed = allDecisionsSaved && reviewAcknowledged

  const sectionTitle = section === 'matches'
    ? labels.decisionMatchesTitle
    : section === 'employment'
      ? labels.decisionEmploymentTitle
      : section === 'fields'
        ? labels.decisionFieldsTitle
        : section === 'conflicts'
          ? labels.decisionConflictsTitle
          : labels.decisionPlanTitle
  const sectionDescription = section === 'matches'
    ? labels.decisionMatchesDescription
    : section === 'employment'
      ? labels.decisionEmploymentDescription
      : section === 'fields'
        ? labels.decisionFieldsDescription
        : section === 'conflicts'
          ? labels.decisionConflictsDescription
          : labels.decisionPlanDescription

  function renderDecisionStatus(row: PayrollImportDecisionRow, draft: PayrollImportDecisionDraft): ReactNode {
    const record = persisted[row.sourceRowNumber]
    const isDirty = dirtyRows.has(row.sourceRowNumber)
    const status: PersistedDecisionStatus = isDirty ? 'DRAFT' : record?.status ?? 'DRAFT'
    const statusLabel = decisionLabel(labels, `decisionStatus_${status}`)
    const selectedEmployee = record?.employeeLabel
      ?? (draft.match.action === 'REUSE_EMPLOYEE' ? decisionLabel(labels, 'decisionSelectedEmployee') : draft.match.action === 'CREATE_EMPLOYEE' ? decisionLabel(labels, 'decisionDraftEmployee') : decisionLabel(labels, 'decisionEmployeeNotSelected'))
    const employmentLabels = Object.entries(draft.employments).map(([sourceRef, decision]) => {
      const label = record?.employmentLabels?.[sourceRef]
        ?? (decision.action === 'REUSE_EMPLOYMENT' ? decisionLabel(labels, 'decisionSelectedEmployment') : decision.action === 'CREATE_DRAFT_EMPLOYMENT' ? decisionLabel(labels, 'decisionDraftEmployment') : decisionLabel(labels, 'decisionEmploymentNotSelected'))
      return <span className="block" key={sourceRef}>{label}</span>
    })
    return <div className="space-y-2 rounded-[var(--radius-control)] border border-border bg-surface p-3 text-sm" data-decision-status={status}>
      <div className="flex flex-wrap items-center justify-between gap-2"><span className={`rounded-[var(--radius-control)] px-2 py-1 text-xs font-semibold ${decisionStatusTone(status)}`}>{statusLabel}</span>{record?.confirmedAt && status === 'SAVED' ? <span className="text-xs text-muted-foreground">{labels.decisionLastConfirmed}: {new Date(record.confirmedAt).toLocaleString()}</span> : null}</div>
      {isDirty ? <p className="text-xs text-warning">{labels.decisionUnsaved}</p> : null}
      {status === 'STALE' ? <p className="text-xs text-warning" role="status">{labels.decisionStale}</p> : null}
      {status === 'CONFLICT' ? <p className="text-xs text-warning" role="status">{labels.decisionConflict}</p> : null}
      {status === 'BLOCKED' ? <p className="text-xs text-destructive" role="status">{labels.decisionBlocked}</p> : null}
      <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2"><span>{labels.decisionSelectedEmployee}: <strong className="font-medium text-foreground">{selectedEmployee}</strong></span><span>{labels.decisionSelectedEmployment}: <strong className="font-medium text-foreground">{employmentLabels.length ? employmentLabels : labels.decisionEmploymentNotSelected}</strong></span></div>
      {record?.blockers.length ? <ul className="list-disc space-y-1 pl-4 text-xs text-destructive">{record.blockers.map((blocker) => <li key={blocker}>{decisionLabel(labels, `decisionBlocker_${blocker}`)}</li>)}</ul> : null}
    </div>
  }

  function renderMatchCard(row: PayrollImportDecisionRow): ReactNode {
    const draft = drafts[row.sourceRowNumber] ?? initialDecisionDraft(row)
    const record = persisted[row.sourceRowNumber]
    const exact = row.match.status === 'EXACT'
    const manualMatch = row.match.status === 'MANUAL_REVIEW'
    const candidateById = new Map<string, DecisionEmployeeCandidate>()
    for (const candidate of row.employeeCandidates ?? []) candidateById.set(candidate.id, candidate)
    const requestedProposedEmployeeId = record?.proposedEmployeeId ?? record?.decision?.match.employeeId ?? row.match.employeeId
    const proposedEmployeeId = requestedProposedEmployeeId && candidateById.has(requestedProposedEmployeeId)
      ? requestedProposedEmployeeId
      : null
    const employeeCandidates = [...candidateById.values()]
    const requestedDraftEmployeeId = draft.match.employeeId
    const candidateEmployeeId = requestedDraftEmployeeId && candidateById.has(requestedDraftEmployeeId)
      ? requestedDraftEmployeeId
      : proposedEmployeeId ?? employeeCandidates[0]?.id
    const employeeCandidateLabel = (candidate: DecisionEmployeeCandidate): string => {
      const displayName = candidate.displayName?.trim()
      const employeeNumber = candidate.employeeNumber?.trim()
      if (displayName && employeeNumber) return `${displayName} · ${employeeNumber}`
      if (displayName) return displayName
      if (employeeNumber) return employeeNumber
      return record?.employeeLabel ?? labels.decisionEmployeeCandidate
    }
    const canReuseEmployee = employeeCandidates.length > 0
    return <Surface className="space-y-4 p-4" key={row.sourceRowNumber} variant="subtle">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{decisionRowLabel(row, labels)}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{labels.decisionMatchStatus}: {labels[`match_${row.match.status}`] ?? row.match.status}{row.match.reason ? ` · ${row.match.reason}` : ''}</p>
        </div>
        <span className={`shrink-0 rounded-[var(--radius-control)] px-2.5 py-1 text-xs font-semibold ${decisionStatusClass(row.status)}`}>{labels[`status_${row.status}`] ?? row.status}</span>
      </div>
      {renderDecisionStatus(row, draft)}
      <RadioGroup
        aria-label={labels.decisionEmployeeChoice}
        disabled={readOnly}
        legend={labels.decisionEmployeeChoice}
        name={`employee-match-${row.sourceRowNumber}`}
        onValueChange={(value) => setMatch(row, value as DecisionEmployeeChoice)}
        options={[
          { disabled: !canReuseEmployee || row.match.status === 'NEW', description: canReuseEmployee ? undefined : labels.decisionEmployeeCandidateUnavailable, label: decisionEmployeeChoiceLabel(labels, 'REUSE_EMPLOYEE'), value: 'REUSE_EMPLOYEE' },
          { disabled: exact || manualMatch, label: decisionEmployeeChoiceLabel(labels, 'CREATE_EMPLOYEE'), value: 'CREATE_EMPLOYEE' },
          { disabled: exact, label: decisionEmployeeChoiceLabel(labels, 'UNRESOLVED'), value: 'UNRESOLVED' },
        ]}
        value={draft.match.action}
      />
      {employeeCandidates.length ? <label className="block text-sm font-medium">{labels.decisionEmployeeCandidate}<DropdownSelect aria-label={labels.decisionEmployeeCandidate} className="mt-2" disabled={readOnly || draft.match.action !== 'REUSE_EMPLOYEE'} onChange={(event) => setMatch(row, 'REUSE_EMPLOYEE', event.target.value)} searchable searchPlaceholder={labels.decisionCandidateSearch} value={candidateEmployeeId ?? ''}>{employeeCandidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{employeeCandidateLabel(candidate)}</option>)}</DropdownSelect></label> : <p className="rounded-[var(--radius-control)] bg-warning-subtle p-3 text-xs text-warning" role="status">{labels.decisionEmployeeCandidateUnavailable}</p>}
      <Checkbox
        aria-label={`${labels.decisionConfirm} ${decisionRowLabel(row, labels)}`}
        checked={draft.match.confirmed}
        disabled={readOnly || draft.match.action === 'UNRESOLVED'}
        label={labels.decisionConfirm}
        onChange={(event) => updateDraft(row, (current) => ({ ...current, match: { ...current.match, confirmed: event.target.checked } }))}
      />
      {exact ? <p className="rounded-[var(--radius-control)] bg-info-surface p-3 text-xs text-foreground" role="status">{labels.decisionExactMatchLocked}</p> : null}
    </Surface>
  }

  function renderEmploymentCard(row: PayrollImportDecisionRow): ReactNode {
    const draft = drafts[row.sourceRowNumber] ?? initialDecisionDraft(row)
    return <Surface className="space-y-4 p-4" key={row.sourceRowNumber} variant="subtle">
      <div><h3 className="text-sm font-semibold">{decisionRowLabel(row, labels)}</h3><p className="mt-1 text-xs text-muted-foreground">{interpolateDecisionLabel(labels, 'decisionIkvCount', { count: row.incomeRelationships.length })}</p></div>
      {renderDecisionStatus(row, draft)}
      <div className="space-y-4">
        {row.incomeRelationships.map((income, index) => {
          const sourceRef = sourceRefForIncome(row, income, index)
          const incomeDecision = draft.incomeRelationships[sourceRef] ?? { action: 'UNDECIDED' as const, confirmed: false }
          const employmentDecision = draft.employments[sourceRef] ?? { action: 'UNDECIDED' as const, confirmed: false }
          const persistedIncomeDecision = persisted[row.sourceRowNumber]?.decision?.incomeRelationships[sourceRef]
          const persistedEmploymentDecision = persisted[row.sourceRowNumber]?.decision?.employments[sourceRef]
          const incomeRelationshipId = persistedIncomeDecision?.incomeRelationshipId
          const employmentId = persistedEmploymentDecision?.employmentId
          const incomeCandidateLabel = `${labels.xmlIkvNumber} ${income.ikvNumber} · ${income.payrollTaxNumber}${income.startsOn ? ` · ${income.startsOn}` : ''}`
          const employmentCandidateLabel = persisted[row.sourceRowNumber]?.employmentLabels?.[sourceRef] ?? labels.decisionSelectedEmployment
          return <div className="space-y-4 rounded-[var(--radius-control)] border border-border bg-surface p-4" key={sourceRef}>
            <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-semibold">{labels.xmlIkvNumber} {income.ikvNumber} · {income.payrollTaxNumber}</p><p className="mt-1 text-xs text-muted-foreground">{income.startsOn ?? labels.emptyValue}{income.endsOn ? ` – ${income.endsOn}` : ''}</p></div><span className="rounded-[var(--radius-control)] bg-surface-subtle px-2 py-1 text-xs text-muted-foreground">{decisionSourceRefLabel(labels, sourceRef)}</span></div>
            <RadioGroup
              aria-label={`${labels.decisionIncomeChoice} ${income.ikvNumber}`}
              disabled={readOnly}
              legend={labels.decisionIncomeChoice}
              name={`income-decision-${sourceRef}`}
              onValueChange={(value) => setIncome(row, sourceRef, value as DecisionIncomeChoice)}
              options={[
                { label: decisionIncomeChoiceLabel(labels, 'CREATE'), value: 'CREATE' },
                { description: incomeRelationshipId ? undefined : labels.decisionIncomeCandidateUnavailable, disabled: !incomeRelationshipId, label: decisionIncomeChoiceLabel(labels, 'LINK'), value: 'LINK' },
                { label: decisionIncomeChoiceLabel(labels, 'NO_CHANGE'), value: 'NO_CHANGE' },
                { label: decisionIncomeChoiceLabel(labels, 'UNDECIDED'), value: 'UNDECIDED' },
              ]}
              value={incomeDecision.action}
            />
            {incomeRelationshipId ? <label className="block text-sm font-medium">{labels.decisionIncomeCandidate}<DropdownSelect aria-label={labels.decisionIncomeCandidate} className="mt-2" disabled={readOnly || incomeDecision.action !== 'LINK'} onChange={(event) => setIncome(row, sourceRef, 'LINK', event.target.value)} searchable searchPlaceholder={labels.decisionCandidateSearch} value={incomeDecision.incomeRelationshipId ?? incomeRelationshipId}><option value={incomeRelationshipId}>{incomeCandidateLabel}</option></DropdownSelect></label> : <p className="rounded-[var(--radius-control)] bg-warning-subtle p-3 text-xs text-warning" role="status">{labels.decisionIncomeCandidateUnavailable}</p>}
            <RadioGroup
              aria-label={`${labels.decisionEmploymentChoice} ${income.ikvNumber}`}
              disabled={readOnly}
              legend={labels.decisionEmploymentChoice}
              name={`employment-decision-${sourceRef}`}
              onValueChange={(value) => setEmployment(row, sourceRef, value as DecisionEmploymentChoice, value === 'REUSE_EMPLOYMENT' ? employmentId : undefined)}
              options={[
                { description: employmentId ? undefined : labels.decisionEmploymentCandidateUnavailable, disabled: !employmentId, label: decisionEmploymentChoiceLabel(labels, 'REUSE_EMPLOYMENT'), value: 'REUSE_EMPLOYMENT' },
                { label: decisionEmploymentChoiceLabel(labels, 'CREATE_DRAFT_EMPLOYMENT'), value: 'CREATE_DRAFT_EMPLOYMENT' },
                { label: decisionEmploymentChoiceLabel(labels, 'UNDECIDED'), value: 'UNDECIDED' },
              ]}
              value={employmentDecision.action}
            />
            {employmentId ? <label className="block text-sm font-medium">{labels.decisionEmploymentCandidate}<DropdownSelect aria-label={labels.decisionEmploymentCandidate} className="mt-2" disabled={readOnly || employmentDecision.action !== 'REUSE_EMPLOYMENT'} onChange={(event) => setEmployment(row, sourceRef, 'REUSE_EMPLOYMENT', event.target.value)} searchable searchPlaceholder={labels.decisionCandidateSearch} value={employmentDecision.employmentId ?? employmentId}><option value={employmentId}>{employmentCandidateLabel}</option></DropdownSelect></label> : <p className="rounded-[var(--radius-control)] bg-warning-subtle p-3 text-xs text-warning" role="status">{labels.decisionEmploymentCandidateUnavailable}</p>}
            <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2"><span>{incomeDecision.confirmed ? labels.decisionConfirmed : labels.decisionNeedsReview}</span><span>{employmentDecision.confirmed ? labels.decisionConfirmed : labels.decisionNeedsReview}</span></div>
          </div>
        })}
      </div>
    </Surface>
  }

  function renderFieldCard(row: PayrollImportDecisionRow): ReactNode {
    const draft = drafts[row.sourceRowNumber] ?? initialDecisionDraft(row)
    const fields = sourceFieldsForRow(row)
    return <Surface className="space-y-4 p-4" key={row.sourceRowNumber} variant="subtle">
      <div><h3 className="text-sm font-semibold">{decisionRowLabel(row, labels)}</h3><p className="mt-1 text-xs text-muted-foreground">{labels.decisionFieldsDescription}</p></div>
      {renderDecisionStatus(row, draft)}
      {fields.length ? fields.map((field) => <RadioGroup
        aria-label={`${labels.decisionFieldChoice} ${decisionFieldLabel(labels, field)}`}
        className="border-t border-border pt-3 first:border-0 first:pt-0"
        disabled={readOnly}
        key={field}
        legend={decisionFieldLabel(labels, field)}
        name={`source-field-${row.sourceRowNumber}-${field}`}
        onValueChange={(value) => setField(row, field, value as DecisionSourceFieldChoice)}
        options={[
          { label: decisionSourceFieldChoiceLabel(labels, 'USE_SOURCE'), value: 'USE_SOURCE' },
          { label: decisionSourceFieldChoiceLabel(labels, 'KEEP_CURRENT'), value: 'KEEP_CURRENT' },
          { label: decisionSourceFieldChoiceLabel(labels, 'MANUAL_REVIEW'), value: 'MANUAL_REVIEW' },
        ]}
        value={draft.sourceFields[field]}
      />) : <p className="text-sm text-muted-foreground">{labels.decisionNoSourceFields}</p>}
    </Surface>
  }

  function renderConflictCard(row: PayrollImportDecisionRow): ReactNode {
    const fields = decisionIssueFields(row)
    const draft = drafts[row.sourceRowNumber] ?? initialDecisionDraft(row)
    return <Surface className="space-y-3 p-4" key={row.sourceRowNumber} variant="subtle">
      <h3 className="text-sm font-semibold">{decisionRowLabel(row, labels)}</h3>
      {renderDecisionStatus(row, draft)}
      {row.issues.length ? <ul className="space-y-2">{row.issues.map((issue, index) => <li className="flex flex-wrap items-start gap-2 text-sm" key={`${issue.code}-${index}`}><span className={`rounded-[var(--radius-control)] px-2 py-1 text-xs font-semibold ${issue.severity === 'BLOCKING' ? 'bg-destructive-subtle text-destructive' : 'bg-warning-subtle text-warning'}`}>{issue.severity}</span><span>{issueLabel(labels, issue.code)}{issue.field ? ` · ${decisionFieldLabel(labels, issue.field)}` : ''}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">{labels.decisionNoConflicts}</p>}
      {fields.length ? <p className="rounded-[var(--radius-control)] bg-warning-subtle p-3 text-xs text-warning">{labels.decisionConflictFieldsNotice}</p> : null}
    </Surface>
  }

  function renderPlan(): ReactNode {
    return <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--radius-control)] bg-surface-subtle p-3"><p className="text-xs text-muted-foreground">{labels.decisionPeople}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{rows.length}</p></div>
        <div className="rounded-[var(--radius-control)] bg-surface-subtle p-3"><p className="text-xs text-muted-foreground">{labels.decisionComplete}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{completeRows.length}</p></div>
        <div className="rounded-[var(--radius-control)] bg-surface-subtle p-3"><p className="text-xs text-muted-foreground">{labels.decisionBlockers}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{blockerCount}</p></div>
      </div>
      <div className={`rounded-[var(--radius-control)] p-4 ${allDecisionsComplete && allDecisionsSaved ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning'}`} role="status"><p className="text-sm font-semibold">{allDecisionsComplete && allDecisionsSaved ? labels.decisionReady : labels.decisionNeedsReview}</p><p className="mt-1 text-sm">{allDecisionsComplete && allDecisionsSaved ? labels.decisionPlanReady : !allDecisionsSaved ? labels.decisionSaveBeforePlan : interpolateDecisionLabel(labels, 'decisionPlanBlockers', { count: blockerCount })}</p></div>
      <Checkbox checked={reviewAcknowledged} disabled={readOnly} label={labels.decisionReviewAcknowledgement} onChange={(event) => setReviewAcknowledged(event.target.checked)} />
      {rows.length ? <div className="space-y-3">{rows.map((row) => {
        const draft = drafts[row.sourceRowNumber] ?? initialDecisionDraft(row)
        const record = persisted[row.sourceRowNumber]
        const canSave = Boolean(batchId && record && !readOnly && dirtyRows.has(row.sourceRowNumber) && savingRow === null)
        return <div className="space-y-3" key={row.sourceRowNumber}>
          {renderDecisionStatus(row, draft)}
          <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm font-medium">{decisionRowLabel(row, labels)}</span><Button disabled={!canSave} loading={savingRow === row.sourceRowNumber} onClick={() => void saveDecision(row)} type="button">{record?.status === 'STALE' ? labels.decisionReconfirm : labels.decisionSave}</Button></div>
        </div>
      })}</div> : null}
      {batchId && !readOnly ? <Button disabled={!planRequestAllowed || planPending} loading={planPending} onClick={() => void requestPlan()} type="button">{planPending ? labels.decisionPlanLoading : labels.decisionRequestPlan}</Button> : null}
      {planResult ? <div className={`space-y-3 rounded-[var(--radius-control)] p-4 ${planResult.status === 'BLOCKED' ? 'bg-warning-subtle text-warning' : 'bg-success-subtle text-success'}`} role="status"><p className="text-sm font-semibold">{planResult.status === 'BLOCKED' ? labels.decisionPlanBlocked : labels.decisionPlanServerReady}</p>{planResult.summary ? <section aria-label={labels.finalizationResultTitle} className="space-y-3 border-t border-current/20 pt-4"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-semibold">{labels.finalizationResultTitle}</h3><span className="text-sm font-semibold">{decisionLabel(labels, `finalizationResultState_${planResult.summary.state}`)}</span></div><p className="text-sm">{labels.finalizationResultNotExecuted}</p><dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">{finalizationSummaryRows(planResult.summary).map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{labels[label] ?? label}</dt><dd className="text-lg font-semibold tabular-nums">{value}</dd></div>)}</dl></section> : null}{planResult.blockers.length ? <ul className="list-disc space-y-1 pl-5 text-sm">{planResult.blockers.map((blocker) => <li key={blocker}>{decisionLabel(labels, `decisionBlocker_${blocker}`)}</li>)}</ul> : null}{planResult.actions.length ? <div><p className="text-sm font-semibold">{labels.decisionPlannedActions}</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{planResult.actions.map((action, index) => <li key={`${action.type ?? 'action'}-${index}`}>{decisionPlanActionLabel(labels, action)}</li>)}</ul></div> : <p className="text-sm">{labels.decisionNoPlannedActions}</p>}</div> : null}
      <div className="space-y-2 rounded-[var(--radius-control)] border border-border p-4"><p className="text-sm font-semibold">{labels.decisionAuditTitle}</p><p className="text-sm text-muted-foreground">{labels.decisionAuditDescription}</p><p className="text-sm text-muted-foreground">{labels.decisionIdempotencyDescription}</p></div>
      <p className="rounded-[var(--radius-control)] border border-border bg-surface-subtle p-4 text-sm text-muted-foreground" role="status">{labels.decisionFinalizationDisabled}</p>
    </div>
  }

  const sectionRows = section === 'conflicts' ? resolvedRows.filter((row) => row.issues.length > 0) : resolvedRows
  return <section aria-labelledby="payroll-decision-workspace" className="space-y-4 border-t border-border pt-5">
    <div><h2 className="text-lg font-semibold" id="payroll-decision-workspace">{sectionTitle}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{sectionDescription}</p></div>
    {!batchId ? <p className="rounded-[var(--radius-control)] border border-warning/30 bg-warning-subtle p-4 text-sm text-warning" role="status">{labels.decisionPersistenceUnavailable}</p> : persistenceLoading ? <p className="rounded-[var(--radius-control)] border border-border bg-surface-subtle p-4 text-sm text-muted-foreground" role="status">{labels.decisionReadbackLoading}</p> : persistenceError ? <p className="rounded-[var(--radius-control)] border border-destructive/30 bg-destructive-subtle p-4 text-sm text-destructive" role="alert">{labels.decisionReadbackError}</p> : <p className="rounded-[var(--radius-control)] border border-border bg-surface-subtle p-4 text-sm text-muted-foreground" role="status">{labels.decisionPersistenceReady}</p>}
    {section === 'preview' ? renderPlan() : sectionRows.length ? <div className="space-y-3">{sectionRows.map((row) => section === 'matches' ? renderMatchCard(row) : section === 'employment' ? renderEmploymentCard(row) : section === 'fields' ? renderFieldCard(row) : renderConflictCard(row))}</div> : <p className="rounded-[var(--radius-control)] bg-surface-subtle p-4 text-sm text-muted-foreground">{labels.decisionNoConflicts}</p>}
  </section>
}

const stepKeys = ['stepExplanation', 'stepPreflight', 'stepFile', 'stepAnalyze', 'stepEmployer', 'stepPeople', 'stepSelect', 'stepPerson', 'stepConflicts', 'stepPreview', 'stepFinal', 'stepReport'] as const

function readinessTone(status: ReadinessStatus): string {
  if (status === 'READY') return 'bg-success-subtle text-success'
  if (status === 'WARNING') return 'bg-warning-subtle text-warning'
  if (status === 'BLOCKED') return 'bg-destructive-subtle text-destructive'
  return 'bg-surface-subtle text-muted-foreground'
}

function readinessLabel(status: ReadinessStatus, labels: Labels): string {
  if (status === 'READY') return labels.readinessReady
  if (status === 'WARNING') return labels.readinessWarning
  if (status === 'BLOCKED') return labels.readinessBlocked
  return labels.readinessNotRequired
}

function readinessCheckStatusLabel(status: ReadinessStatus, labels: Labels): string {
  if (status === 'READY') return labels.readinessCheckStatusReady
  if (status === 'WARNING') return labels.readinessCheckStatusWarning
  if (status === 'BLOCKED') return labels.readinessCheckStatusBlocked
  return labels.readinessCheckStatusNotRequired
}

export function PayrollImportWizard({ administrationId, labels, initialBatchId = null, initialReadiness, initialReadinessError, initialRecoverableImports, initialRecoveryError }: {
  administrationId: string | null
  initialBatchId?: string | null
  labels: Labels
  initialReadiness: PayrollImportReadinessView | null
  initialReadinessError: boolean
  initialRecoverableImports: RecoverableImport[]
  initialRecoveryError: boolean
}) {
  const [step, setStep] = useState(0)
  const [sourceType, setSourceType] = useState<'LOONAANGIFTE_XML' | 'INTERNAL_REPRESENTATIVE'>('INTERNAL_REPRESENTATIVE')
  const [file, setFile] = useState<File | null>(null)
  const [taxYear, setTaxYear] = useState('2026')
  const [periodStart, setPeriodStart] = useState('2026-01-01')
  const [periodEnd, setPeriodEnd] = useState('2026-12-31')
  const [analysis, setAnalysis] = useState<PublicAnalysis | null>(null)
  const [batchId, setBatchId] = useState<string | null>(initialBatchId)
  const [selectedRows, setSelectedRows] = useState<number[]>([])
  const [report, setReport] = useState<FinalizeReport | null>(null)
  const [recoverableImports, setRecoverableImports] = useState(initialRecoverableImports)
  const [recoveryError] = useState(initialRecoveryError)
  const [recoverySelectionBatchId, setRecoverySelectionBatchId] = useState<string | null>(null)
  const [isRecovery, setIsRecovery] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canContinue = Boolean(administrationId && file)
  const selected = useMemo(() => new Set(selectedRows), [selectedRows])
  const isXmlPreview = !isRecovery && analysis?.sourceType === 'LOONAANGIFTE_XML'
  const decisionSection: PayrollImportDecisionWorkspaceProps['section'] = step <= 4
    ? 'matches'
    : step === 5
      ? 'employment'
      : step === 6
        ? 'fields'
        : step === 7
          ? 'conflicts'
          : 'preview'

  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (batchId) {
      if (url.searchParams.get('batchId') === batchId) return
      url.searchParams.set('batchId', batchId)
    } else {
      if (!url.searchParams.has('batchId')) return
      url.searchParams.delete('batchId')
    }
    window.history.replaceState(window.history.state, '', url)
  }, [batchId])

  useEffect(() => {
    if (!initialBatchId || batchId !== initialBatchId || analysis) return
    let cancelled = false
    void (async () => {
      await Promise.resolve()
      if (cancelled) return
      setError(null)
      try {
        const response = await fetch(`/api/payroll/import/batches/${encodeURIComponent(initialBatchId)}/decisions`)
        const payload = await response.json() as unknown
        if (!response.ok) throw new Error(isRecord(payload) && typeof payload.error === 'string' ? payload.error : 'DECISION_READ_FAILED')
        const recovered = decisionAnalysisFromResponse(payload)
        if (!recovered) throw new Error('DECISION_ANALYSIS_READ_FAILED')
        if (cancelled) return
        setAnalysis(recovered)
        setSelectedRows(recovered.sourceType === 'LOONAANGIFTE_XML'
          ? []
          : recovered.rows.filter((row) => row.status !== 'BLOCKING' && row.match.status !== 'MANUAL_REVIEW').map((row) => row.sourceRowNumber))
        setIsRecovery(false)
        setStep(recovered.sourceType === 'LOONAANGIFTE_XML' ? 9 : 4)
      } catch {
        if (!cancelled) setError(labels.decisionReadbackError)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [analysis, batchId, initialBatchId, labels])

  function setFileFromEvent(event: ChangeEvent<HTMLInputElement>): void {
    if (batchId) {
      setBatchId(null)
      setAnalysis(null)
      setIsRecovery(false)
    }
    setFile(event.target.files?.[0] ?? null)
    setError(null)
  }

  function setSourceTypeFromEvent(event: ChangeEvent<HTMLSelectElement>): void {
    if (batchId) {
      setBatchId(null)
      setAnalysis(null)
      setIsRecovery(false)
    }
    setSourceType(event.target.value as typeof sourceType)
  }

  function importForm(): FormData | null {
    if (!file || !administrationId) return null
    const form = new FormData()
    form.set('file', file)
    form.set('sourceType', sourceType)
    form.set('taxYear', taxYear)
    form.set('periodStart', periodStart)
    form.set('periodEnd', periodEnd)
    form.set('administrationId', administrationId)
    return form
  }

  async function stageForDecisionPersistence(): Promise<{ batchId: string; analysis?: PublicAnalysis } | null> {
    const form = importForm()
    if (!form) return null
    const response = await fetch('/api/payroll/import/stage', { method: 'POST', body: form })
    const payload = await response.json() as { data?: { batchId: string; analysis?: PublicAnalysis }; error?: string }
    if (!response.ok || !payload.data?.batchId) {
      const errorCode = payload.error
      setError(errorCode === 'CONVERGENCE_REQUIRED' ? labels.convergenceRequired : errorCode === 'REAL_XML_PENDING' ? labels.xmlFinalizationPending : labels.error)
      return null
    }
    return payload.data
  }

  async function analyze(): Promise<void> {
    const form = importForm()
    if (!form) {
      setError(labels.error)
      return
    }
    setPending(true)
    setError(null)
    setBatchId(null)
    setAnalysis(null)
    setIsRecovery(false)
    try {
      const response = await fetch('/api/payroll/import/analyze', { method: 'POST', body: form })
      const payload = await response.json() as { data?: PublicAnalysis; error?: string }
      if (!response.ok || !payload.data) {
        setError(payload.error === 'REAL_XML_PENDING' ? labels.xmlFinalizationPending : payload.error === 'CONVERGENCE_REQUIRED' ? labels.convergenceRequired : labels.error)
        return
      }
      setAnalysis(payload.data)
      setSelectedRows(payload.data.sourceType === 'LOONAANGIFTE_XML' ? [] : payload.data.rows.filter((row) => row.status !== 'BLOCKING' && row.match.status !== 'MANUAL_REVIEW').map((row) => row.sourceRowNumber))
      if (payload.data.sourceType !== 'LOONAANGIFTE_XML') {
        const staged = await stageForDecisionPersistence()
        if (staged) {
          setBatchId(staged.batchId)
          if (staged.analysis) setAnalysis(staged.analysis)
        }
      } else {
        setBatchId(null)
      }
      setStep(payload.data.sourceType === 'LOONAANGIFTE_XML' ? 9 : 4)
    } catch {
      setError(labels.error)
    } finally {
      setPending(false)
    }
  }

  async function stage(): Promise<void> {
    if (analysis?.sourceType === 'LOONAANGIFTE_XML') {
      setError(labels.xmlReadOnlyError)
      return
    }
    if (!file || !administrationId) return
    setPending(true)
    setError(null)
    setBatchId(null)
    try {
      const staged = await stageForDecisionPersistence()
      if (!staged) return
      setIsRecovery(false)
      setBatchId(staged.batchId)
      if (staged.analysis) setAnalysis(staged.analysis)
      setStep(10)
    } catch {
      setError(labels.error)
    } finally {
      setPending(false)
    }
  }

  async function finalize(): Promise<void> {
    if (analysis?.sourceType === 'LOONAANGIFTE_XML') {
      setError(labels.xmlReadOnlyError)
      return
    }
    if (!batchId || !administrationId) return
    setPending(true)
    setError(null)
    try {
      const response = await fetch('/api/payroll/import/finalize', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ batchId, administrationId, selectedRowNumbers: selectedRows }) })
      const payload = await response.json() as { data?: FinalizeReport; error?: string }
      if (!response.ok || !payload.data) {
        setError(payload.error === 'CONVERGENCE_REQUIRED' ? labels.convergenceRequired : labels.error)
        return
      }
      setReport(payload.data)
      setStep(11)
      if (isRecovery && administrationId) {
        setRecoverableImports((current) => current.flatMap((batch) => {
          if (batch.batchId !== batchId) return [batch]
          const rows = batch.rows.filter((row) => !selectedRows.includes(row.rowNumber))
          return rows.length > 0 ? [{ ...batch, rows }] : []
        }))
      }
    } catch {
      setError(labels.error)
    } finally {
      setPending(false)
    }
  }

  function toggleRow(rowNumber: number): void {
    setSelectedRows((current) => current.includes(rowNumber) ? current.filter((value) => value !== rowNumber) : [...current, rowNumber])
  }

  function toggleRecoveryRow(batchId: string, rowNumber: number): void {
    if (recoverySelectionBatchId !== batchId) {
      setRecoverySelectionBatchId(batchId)
      setSelectedRows([rowNumber])
      return
    }
    toggleRow(rowNumber)
  }

  function beginRecovery(batch: RecoverableImport): void {
    if (recoverySelectionBatchId !== batch.batchId || selectedRows.length === 0) return
    setAnalysis(null)
    setBatchId(batch.batchId)
    setIsRecovery(true)
    setReport(null)
    setError(null)
    setStep(10)
  }

  return <div className="space-y-6">
    <Surface className="p-3"><ScrollableTabs ariaLabel={labels.title} leftLabel={labels.previousSteps} rightLabel={labels.nextSteps}><ol aria-label={labels.title} className="m-0 flex min-w-max list-none gap-2 p-0">{stepKeys.map((key, index) => <li aria-current={index === step ? 'step' : undefined} className={`rounded-[var(--radius-control)] px-3 py-2 text-xs font-medium ${index === step ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`} key={key}>{index + 1}. {labels[key]}</li>)}</ol></ScrollableTabs></Surface>
    <Surface className="p-5 sm:p-7">
      {step === 0 ? <div className="space-y-5"><p className="text-sm leading-6 text-muted-foreground">{labels.description}</p>{initialReadiness ? <section aria-labelledby="payroll-readiness-heading" className="space-y-4 rounded-[var(--radius-control)] border border-border p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="text-base font-semibold" id="payroll-readiness-heading">{labels.readinessTitle}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{labels.readinessDescription}</p></div><span aria-label={`${labels.readinessStatus}: ${readinessLabel(initialReadiness.status, labels)}`} className={`shrink-0 rounded-[var(--radius-control)] px-2.5 py-1 text-xs font-semibold ${readinessTone(initialReadiness.status)}`} role="status">{readinessLabel(initialReadiness.status, labels)}</span></div><div className="grid gap-2 sm:grid-cols-2">{initialReadiness.checks.map((check) => <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] bg-surface-subtle px-3 py-2 text-sm" key={check.key}><span className="min-w-0">{labels[`readinessCheck_${check.key}`] ?? labels.readinessUnknownCheck}</span><span className={`shrink-0 rounded-[var(--radius-control)] px-2 py-1 text-xs font-medium ${readinessTone(check.status)}`}>{readinessCheckStatusLabel(check.status, labels)}</span></div>)}</div>{initialReadiness.payrollTaxNumber ? <p className="text-sm text-muted-foreground">{labels.readinessPayrollTaxNumber}: <span className="font-medium text-foreground">{initialReadiness.payrollTaxNumber}</span></p> : null}</section> : initialReadinessError ? <p className="rounded-[var(--radius-control)] bg-destructive-subtle p-3 text-sm text-destructive" role="alert">{labels.readinessReadError}</p> : null}<p className="rounded-[var(--radius-control)] bg-surface-subtle p-4 text-sm text-muted-foreground">{labels.previewNoWrites}</p>{initialBatchId && !analysis ? <p className="rounded-[var(--radius-control)] border border-warning/30 bg-warning-subtle p-4 text-sm text-warning" role="status">{labels.decisionBatchReloadRequiresAnalysis}</p> : null}{recoveryError ? <p className="rounded-[var(--radius-control)] bg-destructive-subtle p-3 text-sm text-destructive" role="alert">{labels.recoverReadError}</p> : null}{recoverableImports.length > 0 ? <section aria-labelledby="payroll-recovery-heading" className="space-y-3 border-t border-border pt-5"><div><h2 className="text-base font-semibold" id="payroll-recovery-heading">{labels.recoverTitle}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.recoverDescription}</p></div>{recoverableImports.map((batch) => <div className="space-y-3 rounded-[var(--radius-control)] border border-border p-4" key={batch.batchId}><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">{labels.recoverBatch} · {new Date(batch.createdAt).toLocaleString()}</p><p className="text-xs text-muted-foreground">{batch.status}</p></div><div className="space-y-2">{batch.rows.map((row) => <label className="flex items-start gap-3 rounded-[var(--radius-control)] bg-surface-subtle p-3 text-sm" key={row.rowNumber}><input checked={recoverySelectionBatchId === batch.batchId && selected.has(row.rowNumber)} onChange={() => toggleRecoveryRow(batch.batchId, row.rowNumber)} type="checkbox" /><span><span className="font-medium">{row.rowNumber} · {row.firstName ?? labels.emptyValue} {row.birthName ?? ''}</span><span className="mt-1 block text-xs text-muted-foreground">{row.missingEmployment ? labels.recoverMissingEmployment : ''}{row.missingEmployment && row.pendingIncomeCount > 0 ? ' · ' : ''}{row.pendingIncomeCount > 0 ? labels.recoverPendingIncome.replace('{count}', String(row.pendingIncomeCount)) : ''}</span></span></label>)}</div><Button disabled={recoverySelectionBatchId !== batch.batchId || selectedRows.length === 0} onClick={() => beginRecovery(batch)} type="button">{labels.recoverResume}</Button></div>)}</section> : null}<Button onClick={() => setStep(1)} type="button">{labels.next}</Button></div> : null}
      {step === 1 ? <div className="space-y-4"><p className="text-sm text-muted-foreground">{administrationId ? labels.stepPreflight : labels.noActiveAdministration}</p><Button disabled={!administrationId} onClick={() => setStep(2)} type="button">{labels.next}</Button></div> : null}
      {step === 2 ? <div className="space-y-5"><label className="block text-sm font-medium">{labels.sourceType}<DropdownSelect className="mt-2" onChange={setSourceTypeFromEvent} searchable value={sourceType}><option value="INTERNAL_REPRESENTATIVE">{labels.internalRepresentative}</option><option value="LOONAANGIFTE_XML">{labels.loonaangifteXml}</option></DropdownSelect></label><label className="block text-sm font-medium">{labels.file}<TextInput className="mt-2" onChange={setFileFromEvent} type="file" /></label><p className="text-sm leading-6 text-muted-foreground">{labels.fixtureHint}</p><Button disabled={!file} onClick={() => setStep(3)} type="button">{labels.next}</Button></div> : null}
      {step === 3 ? <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-3"><label className="block text-sm font-medium">{labels.taxYear}<TextInput className="mt-2" inputMode="numeric" onChange={(event) => setTaxYear(event.target.value)} value={taxYear} /></label><label className="block text-sm font-medium">{labels.periodStart}<TextInput className="mt-2" onChange={(event) => setPeriodStart(event.target.value)} type="date" value={periodStart} /></label><label className="block text-sm font-medium">{labels.periodEnd}<TextInput className="mt-2" onChange={(event) => setPeriodEnd(event.target.value)} type="date" value={periodEnd} /></label></div><Button disabled={!canContinue} loading={pending} onClick={analyze} type="button">{pending ? labels.analyzing : labels.analyze}</Button></div> : null}
      {step >= 4 && step <= 9 && analysis ? <div className="space-y-5">
        <h2 className="text-xl font-semibold">{labels.analysisTitle}</h2>
        {isXmlPreview ? <div className="rounded-[var(--radius-control)] border border-border bg-surface-subtle p-4" role="status"><p className="text-sm font-semibold">{labels.xmlPreviewTitle}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{labels.xmlPreviewDescription}</p></div> : <p className="text-sm text-muted-foreground">{labels.previewNoWrites}</p>}
        {isXmlPreview && analysis.sourceContext ? <section aria-labelledby="xml-source-details" className="space-y-3 rounded-[var(--radius-control)] border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold" id="xml-source-details">{labels.xmlSourceDetails}</h3><span className="rounded-[var(--radius-control)] bg-surface-subtle px-2.5 py-1 text-xs font-medium">{labels[`xmlParseStatus_${analysis.sourceContext.status}`] ?? labels.xmlParseStatusUnknown}</span></div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {analysis.sourceContext.taxYear ? <div><dt className="text-xs text-muted-foreground">{labels.taxYear}</dt><dd className="mt-1 font-medium">{analysis.sourceContext.taxYear}</dd></div> : null}
            {analysis.sourceContext.schemaVersion ? <div><dt className="text-xs text-muted-foreground">{labels.xmlSchemaVersion}</dt><dd className="mt-1 font-medium">{analysis.sourceContext.schemaVersion}</dd></div> : null}
            {analysis.sourceContext.payrollTaxNumber ? <div><dt className="text-xs text-muted-foreground">{labels.xmlPayrollTaxNumber}</dt><dd className="mt-1 font-medium">{analysis.sourceContext.payrollTaxNumber}</dd></div> : null}
            <div className="sm:col-span-2 lg:col-span-3"><dt className="text-xs text-muted-foreground">{labels.xmlReportingPeriods}</dt><dd className="mt-1">{analysis.sourceContext.reportingPeriods.length ? analysis.sourceContext.reportingPeriods.map((period, index) => <span className="mr-3 inline-block" key={`${period.startsOn}-${index}`}>{period.startsOn} – {period.endsOn}</span>) : labels.xmlNoReportingPeriods}</dd></div>
          </dl>
          {analysis.sourceContext.xsdValidation === 'VALIDATED' ? <p className="rounded-[var(--radius-control)] bg-success-surface p-3 text-sm text-success" role="status">{labels.xmlXsdValidated}</p> : null}
          {analysis.sourceContext.diagnostics.length ? <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">{analysis.sourceContext.diagnostics.map(({ code }, index) => <li key={`${code}-${index}`}>{labels[`xmlDiagnostic_${code}`] ?? labels.xmlDiagnosticUnknown}</li>)}</ul> : null}
        </section> : null}
        {isXmlPreview && analysis.readiness ? <section aria-labelledby="xml-readiness-heading" className="space-y-3 rounded-[var(--radius-control)] border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold" id="xml-readiness-heading">{labels.readinessTitle}</p><span aria-label={`${labels.readinessStatus}: ${readinessLabel(analysis.readiness.status, labels)}`} className={`shrink-0 rounded-[var(--radius-control)] px-2.5 py-1 text-xs font-semibold ${readinessTone(analysis.readiness.status)}`} role="status">{readinessLabel(analysis.readiness.status, labels)}</span></div>
          <div className="grid gap-2 sm:grid-cols-2">{analysis.readiness.checks.map((check, index) => <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] bg-surface-subtle px-3 py-2 text-sm" key={`${check.key}-${index}`}><span className="min-w-0">{labels[`readinessCheck_${check.key}`] ?? labels.readinessUnknownCheck}{check.code ? <span className="mt-1 block text-xs text-muted-foreground">{labels[`readinessCode_${check.code}`] ?? labels.readinessCodeUnknown}</span> : null}</span><span className={`shrink-0 rounded-[var(--radius-control)] px-2 py-1 text-xs font-medium ${readinessTone(check.status)}`}>{readinessCheckStatusLabel(check.status, labels)}</span></div>)}</div>
          {analysis.readiness.payrollTaxNumber ? <p className="text-sm text-muted-foreground">{labels.xmlPayrollTaxNumber}: <span className="font-medium text-foreground">{analysis.readiness.payrollTaxNumber}</span></p> : null}
        </section> : null}
        <div className="grid gap-3 sm:grid-cols-4">{([[labels.total, analysis.summary.total], [labels.green, analysis.summary.green], [labels.warnings, analysis.summary.warnings], [labels.blocking, analysis.summary.blocking]] as const).map(([label, value]) => <div className="rounded-[var(--radius-control)] bg-surface-subtle p-3" key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>)}</div>
        {isXmlPreview ? <section aria-labelledby="xml-identity-source-heading" className="space-y-2 rounded-[var(--radius-control)] border border-border p-4">
          <h3 className="text-sm font-semibold" id="xml-identity-source-heading">{labels.xmlIdentitySourceFields}</h3>
          <ul className="space-y-2 text-sm">{analysis.rows.map((row) => <li className="flex flex-wrap gap-x-3 gap-y-1" key={row.sourceRowNumber}><span className="font-medium">{labels.row} {row.sourceRowNumber}</span>{row.significantSurnamePart ? <span className="text-muted-foreground">{labels.xmlSignificantSurnamePart}: {row.significantSurnamePart}</span> : null}{row.nationalityCode !== undefined ? <span className="text-muted-foreground">{labels.xmlNationalityCode}: {row.nationalityCode}</span> : null}{row.genderCode !== undefined ? <span className="text-muted-foreground">{labels.xmlGenderCode}: {row.genderCode}</span> : null}</li>)}</ul>
        </section> : null}
        <div className="overflow-x-auto"><table className={`w-full text-left text-sm ${isXmlPreview ? 'min-w-[880px]' : 'min-w-[720px]'}`}><thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground"><tr>{isXmlPreview ? null : <th className="px-2 py-3">{labels.select}</th>}<th className="px-2 py-3">{labels.row}</th>{isXmlPreview ? <th className="px-2 py-3">{labels.xmlIncomeRelationships}</th> : null}<th className="px-2 py-3">{labels.status}</th><th className="px-2 py-3">{labels.match}</th><th className="px-2 py-3">{labels.issues}</th></tr></thead><tbody className="divide-y divide-border">{analysis.rows.map((row) => <tr key={row.sourceRowNumber}>{isXmlPreview ? null : <td className="px-2 py-3"><input aria-label={`${labels.select} ${row.sourceRowNumber}`} checked={selected.has(row.sourceRowNumber)} disabled={row.status === 'BLOCKING' || row.match.status === 'MANUAL_REVIEW'} onChange={() => toggleRow(row.sourceRowNumber)} type="checkbox" /></td>}<td className="px-2 py-3">{row.sourceRowNumber} · {row.firstName ?? row.initials ?? labels.emptyValue} {row.birthName ?? ''}</td>{isXmlPreview ? <td className="px-2 py-3"><ul className="space-y-2">{row.incomeRelationships.map((income, index) => <li className="space-y-1" key={`${row.sourceRowNumber}-${index}`}><p className="font-medium">{labels.xmlPayrollTaxNumber}: {income.payrollTaxNumber} · {labels.xmlIkvNumber}: {income.ikvNumber}</p><p className="text-xs text-muted-foreground">{labels.xmlStartsOn}: {income.startsOn ?? labels.emptyValue}{income.endsOn ? ` · ${labels.xmlEndsOn}: ${income.endsOn}` : ''}</p>{income.sourcePeriods?.map((period, periodIndex) => <p className="text-xs text-muted-foreground" key={`${period.startsOn}-${periodIndex}`}>{labels.xmlIncomePeriod}: {period.startsOn} · {labels.xmlIncomeCode}: {period.incomeCode}</p>)}</li>)}</ul></td> : null}<td className="px-2 py-3">{labels[`status_${row.status}`] ?? row.status}</td><td className="px-2 py-3">{labels[`match_${row.match.status}`] ?? row.match.status}</td><td className="px-2 py-3">{row.issues.map((item) => labels[`issue_${item.code}`] ?? labels.unknownWarning).join(', ') || labels.emptyValue}</td></tr>)}</tbody></table></div>
        {batchId ? <DecisionWorkspace batchId={batchId} key={analysis.sourceHash ?? analysis.rows.map((row) => `${row.sourceRowNumber}:${row.match.status}:${row.incomeRelationships.length}`).join('|')} labels={labels} readOnly={false} rows={analysis.rows} section={decisionSection} /> : null}
        <div className="flex flex-wrap items-center gap-3"><Button variant="secondary" onClick={() => setStep(Math.max(0, step - 1))} type="button">{labels.back}</Button>{step === 9 && isXmlPreview ? <p className="min-w-0 flex-1 text-sm text-muted-foreground" role="status">{labels.xmlReadOnlyNotice}</p> : <Button loading={pending} onClick={() => step === 9 ? stage() : setStep(step + 1)} type="button">{step === 9 ? labels.confirmPreview : labels.next}</Button>}</div>
      </div> : null}
      {step === 10 && (analysis || isRecovery) ? isXmlPreview ? <div className="space-y-5"><p className="rounded-[var(--radius-control)] border border-border bg-surface-subtle p-4 text-sm text-muted-foreground" role="status">{labels.xmlReadOnlyNotice}</p><Button variant="secondary" onClick={() => setStep(9)} type="button">{labels.back}</Button></div> : <div className="space-y-5">{isRecovery ? <><p className="rounded-[var(--radius-control)] bg-warning-subtle p-4 text-sm text-warning">{labels.recoverFinalizationNotice.replace('{count}', String(selectedRows.length))}</p><p className="text-sm text-muted-foreground">{labels.previewNoWrites}</p></> : <><p className="rounded-[var(--radius-control)] bg-success-subtle p-4 text-sm text-success">{labels.staged}</p><p className="text-sm text-muted-foreground">{labels.previewNoWrites}</p></>}<Button loading={pending} onClick={finalize} type="button">{pending ? labels.finalizing : labels.finalize}</Button></div> : null}
      {step === 11 && report ? <div className="space-y-5"><h2 className="text-xl font-semibold">{labels.reportTitle}</h2><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-[var(--radius-control)] bg-surface-subtle p-3"><p className="text-xs text-muted-foreground">{labels.employeesImported}</p><p className="mt-1 text-2xl font-semibold">{report.employeesImported}</p></div><div className="rounded-[var(--radius-control)] bg-surface-subtle p-3"><p className="text-xs text-muted-foreground">{labels.employmentsCreated}</p><p className="mt-1 text-2xl font-semibold">{report.employmentsCreated}</p></div><div className="rounded-[var(--radius-control)] bg-surface-subtle p-3"><p className="text-xs text-muted-foreground">{labels.incomeRelationshipsImported}</p><p className="mt-1 text-2xl font-semibold">{report.incomeRelationshipsImported}</p></div></div><h3 className="font-semibold">{labels.warningsTitle}</h3>{report.warnings.length === 0 ? <p className="text-sm text-muted-foreground">{labels.noWarnings}</p> : <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">{report.warnings.map((warning) => { const match = /^ROW_(\d+)_(.+)$/.exec(warning); const template = labels[`warning_${match?.[2] ?? warning}`] ?? labels.unknownWarning; return <li key={warning}>{template.replace('{row}', match?.[1] ?? '')}</li> })}</ul>}</div> : null}
      {error ? <p className="mt-5 rounded-[var(--radius-control)] bg-destructive-subtle px-3 py-2 text-sm text-destructive" role="alert">{error}</p> : null}
    </Surface>
  </div>
}
