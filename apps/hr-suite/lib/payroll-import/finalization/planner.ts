import { createHash } from 'node:crypto'
import { isValidIsoDate, isValidLoonaangifteLhNr } from '../model'
import { CONTROL02_APPROVED_CONTRACT_VERSIONS } from './contract'
import { canUseSourceForEmployee } from './field-conflict-policy'
import {
  isPayrollImportDecisionAuthentic,
  isPayrollImportDecisionFresh,
  stableSerialize,
  validatePayrollImportDecision,
  type ConfirmedPayrollImportDecision,
  type PayrollImportDecisionSource,
} from './decision-contract'

export type PayrollFinalizationActionType =
  | 'REUSE_EMPLOYEE'
  | 'CREATE_EMPLOYEE'
  | 'ADD_ADMINISTRATION_ASSIGNMENT'
  | 'UPDATE_EMPLOYEE_FIELDS'
  | 'REUSE_EMPLOYMENT'
  | 'CREATE_DRAFT_EMPLOYMENT'
  | 'CREATE_INCOME_RELATIONSHIP'
  | 'LINK_INCOME_RELATIONSHIP'
  | 'NO_CHANGE'
  | 'REQUIRES_REVIEW'
  | 'BLOCKED'

export type PayrollFinalizationAction = {
  actionId: string
  idempotencyKey: string
  type: PayrollFinalizationActionType
  dependsOnActionIds: readonly string[]
  sourcePersonRef: string
  sourceIncomeRef?: string
  sourceRefs: readonly string[]
  targetEmployeeId?: string
  /** Stable source reference used before a newly created Employee has a Core id. */
  targetEmployeeRef?: string
  targetEmploymentId?: string
  /** Stable source reference used before a newly created Employment has a Core id. */
  targetEmploymentRef?: string
  targetIncomeRelationshipId?: string
  sourcePayrollTaxNumber?: string
  sourceIkvNumber?: number
  sourceStartsOn?: string
  sourceEndsOn?: string | null
  fieldNames?: readonly string[]
  preconditions: readonly string[]
}

export type PayrollFinalizationPlanBlocker =
  | 'XML_FINALIZATION_DISABLED'
  | 'SOURCE_TYPE_UNSUPPORTED'
  | 'SOURCE_PROVENANCE_UNVERIFIED'
  | 'OFFICIAL_SCHEMA_UNVERIFIED'
  | 'SOURCE_NOT_IMMUTABLE'
  | 'SCOPE_INVARIANT_MIGRATION_NOT_APPLIED'
  | 'SHARED_CONTRACT_PENDING'
  | 'DECISION_MISSING'
  | 'DECISION_INVALID'
  | 'DECISION_CONFIRMATION_INVALID'
  | 'DECISION_SHAPE_INVALID'
  | 'MATCH_CONFIRMATION_REQUIRED'
  | 'EMPLOYEE_SELECTION_REQUIRED'
  | 'EXACT_MATCH_TARGET_CHANGED'
  | 'INCOME_RELATIONSHIP_DECISION_REQUIRED'
  | 'EMPLOYMENT_SELECTION_REQUIRED'
  | 'EMPLOYMENT_DECISION_CONFIRMATION_REQUIRED'
  | 'SOURCE_FIELD_DECISION_REQUIRED'
  | 'UNKNOWN_SOURCE_FIELD'
  | 'UNKNOWN_INCOME_RELATIONSHIP'
  | 'DECISION_SOURCE_STALE'
  | 'DECISION_CORE_STATE_STALE'
  | 'DECISION_ACTOR_MISMATCH'
  | 'EMPLOYEE_NOT_FOUND_OR_OUT_OF_SCOPE'
  | 'EMPLOYEE_SCOPE_MISMATCH'
  | 'EMPLOYEE_CREATE_NOT_CONFIRMED'
  | 'FIRST_NAME_NOT_CONFIRMED'
  | 'ADMINISTRATION_ASSIGNMENT_INVALID'
  | 'EMPLOYMENT_NOT_SELECTED'
  | 'EMPLOYMENT_SCOPE_MISMATCH'
  | 'EMPLOYMENT_NOT_CONFIRMED'
  | 'EMPLOYMENT_PERIOD_MISMATCH'
  | 'INCOME_RELATIONSHIP_NOT_SELECTED'
  | 'INCOME_RELATIONSHIP_NOT_FOUND_OR_OUT_OF_SCOPE'
  | 'INCOME_RELATIONSHIP_IDENTITY_MISMATCH'
  | 'INCOME_RELATIONSHIP_IDENTITY_CONFLICT'
  | 'INCOME_RELATIONSHIP_EMPLOYMENT_MISMATCH'
  | 'DUPLICATE_INCOME_RELATIONSHIP'
  | 'DUPLICATE_SOURCE_IKV_IDENTITY'
  | 'SOURCE_IKV_IDENTITY_INVALID'
  | 'SOURCE_PERIOD_REQUIRED'
  | 'SOURCE_FIELD_REVIEW_REQUIRED'
  | 'PERSON_REFERENCE_MISMATCH'
  | 'DUPLICATE_SOURCE_INCOME_REFERENCE'
  | 'SOURCE_INCOME_REFERENCE_MISMATCH'
  | 'DUPLICATE_SOURCE_PERSON_REFERENCE'

export type PayrollFinalizationPlanWarning = 'EXPLICIT_SOURCE_FIELD_UPDATE' | 'DRAFT_EMPLOYMENT_REQUIRES_CONTRACT_MAPPING'

export type PayrollFinalizationPlanPerson = {
  sourcePersonRef: string
  decisionHash: string | null
  decisionVersion: number | null
  confirmerUserId: string | null
  status: 'READY_FOR_REVIEW' | 'REQUIRES_REVIEW' | 'BLOCKED'
  actions: readonly PayrollFinalizationAction[]
  warnings: readonly PayrollFinalizationPlanWarning[]
  blockers: readonly PayrollFinalizationPlanBlocker[]
  sourceIncomeRefs: readonly string[]
}

export type PayrollFinalizationPlannerInput = {
  batch: {
    batchId: string
    tenantId: string
    hrGroupId: string
    administrationId: string
    sourceType: 'LOONAANGIFTE_XML' | 'INTERNAL_REPRESENTATIVE'
    sourceHash: string
    analysisHash: string
    schemaVersion: string | null
    officialSchemaValidated: boolean
    sourceImmutable: boolean
  }
  contractVersion: string | null
  scopeInvariantMigrationApplied: boolean
  currentUserId: string
  currentCoreStateHash: string
  people: readonly PayrollFinalizationPlannerPersonInput[]
  coreState: {
    employees: readonly PayrollFinalizationEmployee[]
    employments: readonly PayrollFinalizationEmployment[]
    incomeRelationships: readonly PayrollFinalizationIncomeRelationship[]
  }
}

export type PayrollFinalizationPlannerPersonInput = {
  sourceRef: string
  decisionSource: PayrollImportDecisionSource
  confirmedDecision: ConfirmedPayrollImportDecision | null
  incomeRelationships: readonly PayrollFinalizationSourceIncomeRelationship[]
}

export type PayrollFinalizationSourceIncomeRelationship = {
  sourceRef: string
  payrollTaxNumber: string
  ikvNumber: number
  startsOn: string | null
  endsOn: string | null
}

export type PayrollFinalizationEmployee = {
  id: string
  tenantId: string
  hrGroupId: string
  administrationIds: readonly string[]
}

export type PayrollFinalizationEmployment = {
  id: string
  employeeId: string
  tenantId: string
  hrGroupId: string
  administrationId: string
  status: 'CONFIRMED' | 'DRAFT' | 'ENDED' | 'OTHER'
  validFrom: string
  /** Exclusive upper bound for planner interval checks; normalize inclusive Core ends_on before building a plan. */
  validUntilExclusive: string | null
}

export type PayrollFinalizationIncomeRelationship = {
  id: string
  employeeId: string
  tenantId: string
  hrGroupId: string
  administrationId: string
  payrollTaxNumber: string
  ikvNumber: number
  startsOn: string | null
  endsOn: string | null
  employmentId: string | null
}

export type PayrollFinalizationPlan = {
  batchId: string
  tenantId: string
  hrGroupId: string
  administrationId: string
  sourceHash: string
  analysisHash: string
  coreStateHash: string
  planHash: string
  status: 'BLOCKED' | 'READY_FOR_REVIEW'
  canExecute: false
  contractVersion: string | null
  schemaVersion: string | null
  blockers: readonly PayrollFinalizationPlanBlocker[]
  people: readonly PayrollFinalizationPlanPerson[]
}

function digest(value: unknown): string {
  return createHash('sha256').update(stableSerialize(value), 'utf8').digest('hex')
}

function isInScope(
  row: { tenantId: string; hrGroupId: string; administrationId?: string },
  input: PayrollFinalizationPlannerInput,
): boolean {
  return row.tenantId === input.batch.tenantId
    && row.hrGroupId === input.batch.hrGroupId
    && (row.administrationId === undefined || row.administrationId === input.batch.administrationId)
}

function isPeriodCovered(
  employment: PayrollFinalizationEmployment,
  income: PayrollFinalizationSourceIncomeRelationship,
): boolean {
  if (!income.startsOn || employment.validFrom > income.startsOn) return false
  if (employment.validUntilExclusive && (!income.endsOn || income.endsOn >= employment.validUntilExclusive)) return false
  if (income.endsOn && income.endsOn < income.startsOn) return false
  return true
}

function action(
  input: PayrollFinalizationPlannerInput,
  sourcePersonRef: string,
  type: PayrollFinalizationActionType,
  options: Omit<Partial<PayrollFinalizationAction>, 'actionId' | 'idempotencyKey' | 'type' | 'sourcePersonRef'> = {},
): PayrollFinalizationAction {
  const sourceRefs = [...(options.sourceRefs ?? [])].sort()
  const identity = {
    batchId: input.batch.batchId,
    tenantId: input.batch.tenantId,
    hrGroupId: input.batch.hrGroupId,
    administrationId: input.batch.administrationId,
    sourceHash: input.batch.sourceHash,
    sourcePersonRef,
    type,
    sourceIncomeRef: options.sourceIncomeRef ?? null,
    sourceRefs,
    targetEmployeeId: options.targetEmployeeId ?? null,
    targetEmployeeRef: options.targetEmployeeRef ?? null,
    targetEmploymentId: options.targetEmploymentId ?? null,
    targetEmploymentRef: options.targetEmploymentRef ?? null,
    targetIncomeRelationshipId: options.targetIncomeRelationshipId ?? null,
    sourcePayrollTaxNumber: options.sourcePayrollTaxNumber ?? null,
    sourceIkvNumber: options.sourceIkvNumber ?? null,
    sourceStartsOn: options.sourceStartsOn ?? null,
    sourceEndsOn: options.sourceEndsOn ?? null,
    fieldNames: [...(options.fieldNames ?? [])].sort(),
  }
  const idempotencyKey = digest(identity)
  return {
    actionId: `payroll-finalize:${idempotencyKey.slice(0, 24)}`,
    idempotencyKey,
    type,
    dependsOnActionIds: [],
    sourcePersonRef,
    sourceRefs,
    preconditions: [...(options.preconditions ?? [])].sort(),
    ...(options.sourceIncomeRef ? { sourceIncomeRef: options.sourceIncomeRef } : {}),
    ...(options.targetEmployeeId ? { targetEmployeeId: options.targetEmployeeId } : {}),
    ...(options.targetEmployeeRef ? { targetEmployeeRef: options.targetEmployeeRef } : {}),
    ...(options.targetEmploymentId ? { targetEmploymentId: options.targetEmploymentId } : {}),
    ...(options.targetEmploymentRef ? { targetEmploymentRef: options.targetEmploymentRef } : {}),
    ...(options.targetIncomeRelationshipId ? { targetIncomeRelationshipId: options.targetIncomeRelationshipId } : {}),
    ...(options.sourcePayrollTaxNumber ? { sourcePayrollTaxNumber: options.sourcePayrollTaxNumber } : {}),
    ...(options.sourceIkvNumber !== undefined ? { sourceIkvNumber: options.sourceIkvNumber } : {}),
    ...(options.sourceStartsOn ? { sourceStartsOn: options.sourceStartsOn } : {}),
    ...(options.sourceEndsOn !== undefined ? { sourceEndsOn: options.sourceEndsOn } : {}),
    ...(options.fieldNames ? { fieldNames: [...options.fieldNames].sort() } : {}),
  }
}

function withActionDependencies(actions: readonly PayrollFinalizationAction[]): PayrollFinalizationAction[] {
  const employeeAction = actions.find(({ type }) => type === 'CREATE_EMPLOYEE' || type === 'REUSE_EMPLOYEE')
  const assignmentAction = actions.find(({ type }) => type === 'ADD_ADMINISTRATION_ASSIGNMENT')
  const employeeDependentTypes = new Set<PayrollFinalizationActionType>([
    'ADD_ADMINISTRATION_ASSIGNMENT',
    'UPDATE_EMPLOYEE_FIELDS',
    'REUSE_EMPLOYMENT',
    'CREATE_DRAFT_EMPLOYMENT',
    'CREATE_INCOME_RELATIONSHIP',
    'LINK_INCOME_RELATIONSHIP',
  ])
  const administrationDependentTypes = new Set<PayrollFinalizationActionType>([
    'REUSE_EMPLOYMENT',
    'CREATE_DRAFT_EMPLOYMENT',
    'CREATE_INCOME_RELATIONSHIP',
    'LINK_INCOME_RELATIONSHIP',
  ])

  return actions.map((current) => {
    const dependencies = new Set<string>()
    if (employeeAction && employeeAction.actionId !== current.actionId && employeeDependentTypes.has(current.type)) {
      dependencies.add(employeeAction.actionId)
    }
    if (assignmentAction && assignmentAction.actionId !== current.actionId && administrationDependentTypes.has(current.type)) {
      dependencies.add(assignmentAction.actionId)
    }
    if (current.sourceIncomeRef && administrationDependentTypes.has(current.type)) {
      const employmentAction = actions.find((candidate) => candidate.actionId !== current.actionId
        && (candidate.type === 'REUSE_EMPLOYMENT' || candidate.type === 'CREATE_DRAFT_EMPLOYMENT')
        && candidate.sourceRefs.includes(current.sourceIncomeRef!))
      if (employmentAction) dependencies.add(employmentAction.actionId)
    }
    return { ...current, dependsOnActionIds: [...dependencies].sort() }
  })
}

function planPerson(input: PayrollFinalizationPlannerInput, person: PayrollFinalizationPlannerPersonInput): PayrollFinalizationPlanPerson {
  const blockers = new Set<PayrollFinalizationPlanBlocker>()
  const warnings = new Set<PayrollFinalizationPlanWarning>()
  const actions: PayrollFinalizationAction[] = []
  const incomes = [...person.incomeRelationships].sort((left, right) => left.sourceRef.localeCompare(right.sourceRef))
  const incomeRefs = incomes.map(({ sourceRef }) => sourceRef)
  const confirmed = person.confirmedDecision
  const employeeTargetRef = `new-employee:${input.batch.batchId}:${person.sourceRef}`
  const draftEmploymentRef = `draft-employment:${input.batch.batchId}:${person.sourceRef}`

  if (person.sourceRef !== person.decisionSource.personId) blockers.add('PERSON_REFERENCE_MISMATCH')
  if (new Set(incomeRefs).size !== incomeRefs.length) blockers.add('DUPLICATE_SOURCE_INCOME_REFERENCE')
  const sourceIvkIdentities = incomes.map((income) => [
    income.payrollTaxNumber,
    income.ikvNumber,
    income.startsOn,
    income.endsOn,
  ].join('\u0000'))
  if (new Set(sourceIvkIdentities).size !== sourceIvkIdentities.length) blockers.add('DUPLICATE_SOURCE_IKV_IDENTITY')
  const declaredIncomeRefs = person.decisionSource.incomeRelationships.map(({ sourceRef }) => sourceRef).sort()
  if (declaredIncomeRefs.join('\u0000') !== [...incomeRefs].sort().join('\u0000')) {
    blockers.add('SOURCE_INCOME_REFERENCE_MISMATCH')
  }

  if (!confirmed) blockers.add('DECISION_MISSING')
  if (confirmed) {
    if (!isPayrollImportDecisionAuthentic(confirmed)) blockers.add('DECISION_CONFIRMATION_INVALID')
    const validation = validatePayrollImportDecision(confirmed.decision, {
      ...person.decisionSource,
      incomeRelationships: incomes.map(({ sourceRef }) => ({ sourceRef })),
    })
    if (!validation.valid) {
      blockers.add('DECISION_INVALID')
      for (const blocker of validation.blockers) blockers.add(blocker)
    }
    if (!isPayrollImportDecisionFresh(confirmed, {
      sourceHash: input.batch.sourceHash,
      analysisHash: input.batch.analysisHash,
      coreStateHash: input.currentCoreStateHash,
    })) {
      if (confirmed.sourceHash !== input.batch.sourceHash || confirmed.analysisHash !== input.batch.analysisHash) {
        blockers.add('DECISION_SOURCE_STALE')
      }
      if (confirmed.coreStateHash !== input.currentCoreStateHash) blockers.add('DECISION_CORE_STATE_STALE')
    }
    if (confirmed.confirmerUserId !== input.currentUserId) blockers.add('DECISION_ACTOR_MISMATCH')
  }

  const selectedEmployeeId = confirmed?.decision.match.employeeId
  const selectedEmployee = selectedEmployeeId
    ? input.coreState.employees.find((candidate) => candidate.id === selectedEmployeeId)
    : undefined
  const creatingEmployee = confirmed?.decision.match.action === 'CREATE_EMPLOYEE'

  if (creatingEmployee) {
    if (!confirmed?.decision.match.confirmed) blockers.add('EMPLOYEE_CREATE_NOT_CONFIRMED')
    if (!person.decisionSource.sourceFields.includes('firstName')
      || confirmed?.decision.sourceFieldDecisions.firstName !== 'USE_SOURCE') {
      blockers.add('FIRST_NAME_NOT_CONFIRMED')
    }
    const fieldsToCreate = Object.entries(confirmed?.decision.sourceFieldDecisions ?? {})
      .filter(([, choice]) => choice === 'USE_SOURCE')
      .map(([field]) => field)
    if (fieldsToCreate.some((field) => !canUseSourceForEmployee(field, 'CREATE'))) {
      blockers.add('SOURCE_FIELD_REVIEW_REQUIRED')
    }
    if (blockers.size === 0) {
      actions.push(action(input, person.sourceRef, 'CREATE_EMPLOYEE', {
        sourceRefs: [person.sourceRef],
        targetEmployeeRef: employeeTargetRef,
        fieldNames: fieldsToCreate,
        preconditions: ['HUMAN_CONFIRMED_NEW_EMPLOYEE', 'NO_EXACT_MATCH_IN_HR_GROUP'],
      }))
    }
  } else if (confirmed?.decision.match.action === 'REUSE_EMPLOYEE') {
    if (!selectedEmployee) {
      blockers.add('EMPLOYEE_NOT_FOUND_OR_OUT_OF_SCOPE')
    } else if (!isInScope(selectedEmployee, input)) {
      blockers.add('EMPLOYEE_SCOPE_MISMATCH')
    } else {
      actions.push(action(input, person.sourceRef, 'REUSE_EMPLOYEE', {
        targetEmployeeId: selectedEmployee.id,
        sourceRefs: [person.sourceRef],
        preconditions: ['EMPLOYEE_IN_TENANT_AND_HR_GROUP'],
      }))
      if (!selectedEmployee.administrationIds.includes(input.batch.administrationId)) {
        actions.push(action(input, person.sourceRef, 'ADD_ADMINISTRATION_ASSIGNMENT', {
          targetEmployeeId: selectedEmployee.id,
          sourceRefs: [person.sourceRef],
          preconditions: ['ADMINISTRATION_BELONGS_TO_HR_GROUP', 'ASSIGNMENT_NOT_ALREADY_PRESENT'],
        }))
      }
      const fieldsToUpdate = Object.entries(confirmed.decision.sourceFieldDecisions)
        .filter(([, choice]) => choice === 'USE_SOURCE')
        .map(([field]) => field)
        .sort()
      if (fieldsToUpdate.some((field) => !canUseSourceForEmployee(field, 'UPDATE'))) {
        blockers.add('SOURCE_FIELD_REVIEW_REQUIRED')
      } else if (fieldsToUpdate.length > 0) {
        actions.push(action(input, person.sourceRef, 'UPDATE_EMPLOYEE_FIELDS', {
          targetEmployeeId: selectedEmployee.id,
          sourceRefs: [person.sourceRef],
          fieldNames: fieldsToUpdate,
          preconditions: ['EXPLICIT_HUMAN_FIELD_DECISIONS', 'CURRENT_EMPLOYEE_STATE_REVALIDATED'],
        }))
        warnings.add('EXPLICIT_SOURCE_FIELD_UPDATE')
      }
    }
  } else if (confirmed?.decision.match.action === 'UNRESOLVED') {
    blockers.add('DECISION_INVALID')
  }

  const draftEmploymentRefs = new Set<string>()
  const employmentTargetByIncome = new Map<string, { employmentId?: string; employmentRef?: string }>()
  const reusedEmploymentIncomeRefs = new Map<string, string[]>()
  for (const income of incomes) {
    const employmentDecision = confirmed?.decision.employmentByIncomeRelationship[income.sourceRef]
    if (!employmentDecision || employmentDecision.action === 'UNDECIDED') {
      blockers.add('EMPLOYMENT_NOT_SELECTED')
      continue
    }
    if (!employmentDecision.confirmed) {
      blockers.add('EMPLOYMENT_NOT_CONFIRMED')
      continue
    }
    if (employmentDecision.action === 'CREATE_DRAFT_EMPLOYMENT') {
      draftEmploymentRefs.add(income.sourceRef)
      employmentTargetByIncome.set(income.sourceRef, { employmentRef: draftEmploymentRef })
      continue
    }
    const employment = employmentDecision.employmentId
      ? input.coreState.employments.find((candidate) => candidate.id === employmentDecision.employmentId)
      : undefined
    if (!employment || !isInScope(employment, input) || employment.employeeId !== selectedEmployeeId) {
      blockers.add('EMPLOYMENT_SCOPE_MISMATCH')
      continue
    }
    if (employment.status !== 'CONFIRMED') {
      blockers.add('EMPLOYMENT_NOT_CONFIRMED')
      continue
    }
    if (!isPeriodCovered(employment, income)) blockers.add('EMPLOYMENT_PERIOD_MISMATCH')
    employmentTargetByIncome.set(income.sourceRef, { employmentId: employment.id })
    reusedEmploymentIncomeRefs.set(employment.id, [
      ...(reusedEmploymentIncomeRefs.get(employment.id) ?? []),
      income.sourceRef,
    ])
  }

  if (blockers.size === 0) {
    for (const [employmentId, sourceRefs] of [...reusedEmploymentIncomeRefs.entries()].sort(([left], [right]) => left.localeCompare(right))) {
      actions.push(action(input, person.sourceRef, 'REUSE_EMPLOYMENT', {
        targetEmployeeId: selectedEmployeeId,
        targetEmploymentId: employmentId,
        sourceRefs,
        preconditions: [
          'EMPLOYMENT_IN_TENANT_HR_GROUP_AND_ADMINISTRATION',
          'EMPLOYMENT_PERIOD_COVERS_SOURCE_INTERVAL',
          'EMPLOYMENT_ASSOCIATION_EXPLICITLY_SELECTED',
        ],
      }))
    }
  }

  if (draftEmploymentRefs.size > 0 && blockers.size === 0) {
    const draftIncomeRefs = [...draftEmploymentRefs].sort()
    actions.push(action(input, person.sourceRef, 'CREATE_DRAFT_EMPLOYMENT', {
      sourceRefs: draftIncomeRefs,
      ...(selectedEmployeeId ? { targetEmployeeId: selectedEmployeeId } : { targetEmployeeRef: employeeTargetRef }),
      targetEmploymentRef: draftEmploymentRef,
      preconditions: [
        'EXPLICIT_HUMAN_DRAFT_DECISION',
        'NO_CONTRACT_TYPE_INFERRED',
        'EMPLOYMENT_CORE_CONTRACT_APPROVED',
      ],
    }))
    warnings.add('DRAFT_EMPLOYMENT_REQUIRES_CONTRACT_MAPPING')
  }

  for (const income of incomes) {
    const sourceDecision = confirmed?.decision.incomeRelationshipBySourceRef[income.sourceRef]
    if (!sourceDecision || sourceDecision.action === 'UNDECIDED') {
      blockers.add('INCOME_RELATIONSHIP_NOT_SELECTED')
      continue
    }
    if (!isValidLoonaangifteLhNr(income.payrollTaxNumber) || !Number.isInteger(income.ikvNumber)
      || income.ikvNumber < 1 || income.ikvNumber > 99) {
      blockers.add('SOURCE_IKV_IDENTITY_INVALID')
      continue
    }
    if (!income.startsOn || !isValidIsoDate(income.startsOn)
      || (income.endsOn !== null && (!isValidIsoDate(income.endsOn) || income.endsOn < income.startsOn))) {
      blockers.add('SOURCE_PERIOD_REQUIRED')
      continue
    }

    const duplicates = selectedEmployeeId ? input.coreState.incomeRelationships.filter((candidate) =>
      candidate.employeeId === selectedEmployeeId
      && candidate.tenantId === input.batch.tenantId
      && candidate.hrGroupId === input.batch.hrGroupId
      && candidate.administrationId === input.batch.administrationId
      && candidate.payrollTaxNumber === income.payrollTaxNumber
      && candidate.ikvNumber === income.ikvNumber
      && candidate.startsOn === income.startsOn
      && candidate.endsOn === income.endsOn) : []
    const conflictingIvk = selectedEmployeeId ? input.coreState.incomeRelationships.some((candidate) =>
      candidate.employeeId === selectedEmployeeId
      && candidate.tenantId === input.batch.tenantId
      && candidate.hrGroupId === input.batch.hrGroupId
      && candidate.administrationId === input.batch.administrationId
      && candidate.ikvNumber === income.ikvNumber
      && (candidate.payrollTaxNumber !== income.payrollTaxNumber
        || candidate.startsOn !== income.startsOn
        || candidate.endsOn !== income.endsOn)) : false

    if (sourceDecision.action === 'CREATE') {
      if (duplicates.length > 0) {
        blockers.add('DUPLICATE_INCOME_RELATIONSHIP')
        continue
      }
      if (conflictingIvk) {
        blockers.add('INCOME_RELATIONSHIP_IDENTITY_CONFLICT')
        continue
      }
      actions.push(action(input, person.sourceRef, 'CREATE_INCOME_RELATIONSHIP', {
        sourceIncomeRef: income.sourceRef,
        ...(selectedEmployeeId ? { targetEmployeeId: selectedEmployeeId } : { targetEmployeeRef: employeeTargetRef }),
        ...(employmentTargetByIncome.get(income.sourceRef)?.employmentId
          ? { targetEmploymentId: employmentTargetByIncome.get(income.sourceRef)?.employmentId }
          : { targetEmploymentRef: employmentTargetByIncome.get(income.sourceRef)?.employmentRef }),
        sourceRefs: [income.sourceRef],
        sourcePayrollTaxNumber: income.payrollTaxNumber,
        sourceIkvNumber: income.ikvNumber,
        sourceStartsOn: income.startsOn,
        sourceEndsOn: income.endsOn,
        preconditions: [
          'FULL_LHNR_AND_IKV_PRESERVED',
          'HISTORICAL_TAX_NUMBER_BINDING_COVERS_SOURCE_PERIOD',
          'EMPLOYMENT_ASSOCIATION_EXPLICITLY_SELECTED',
        ],
      }))
      continue
    }

    const exactIdentityMatches = input.coreState.incomeRelationships.filter((candidate) =>
      isInScope(candidate, input)
      && candidate.employeeId === selectedEmployeeId
      && candidate.payrollTaxNumber === income.payrollTaxNumber
      && candidate.ikvNumber === income.ikvNumber
      && candidate.startsOn === income.startsOn
      && candidate.endsOn === income.endsOn)
    const existing = sourceDecision.incomeRelationshipId
      ? input.coreState.incomeRelationships.find((candidate) => candidate.id === sourceDecision.incomeRelationshipId)
      : sourceDecision.action === 'NO_CHANGE' && exactIdentityMatches.length === 1
        ? exactIdentityMatches[0]
        : undefined
    if (!existing || !isInScope(existing, input) || existing.employeeId !== selectedEmployeeId) {
      blockers.add('INCOME_RELATIONSHIP_NOT_FOUND_OR_OUT_OF_SCOPE')
      continue
    }
    if (existing.payrollTaxNumber !== income.payrollTaxNumber || existing.ikvNumber !== income.ikvNumber
      || existing.startsOn !== income.startsOn || existing.endsOn !== income.endsOn) {
      blockers.add('INCOME_RELATIONSHIP_IDENTITY_MISMATCH')
      continue
    }

    const targetEmployment = employmentTargetByIncome.get(income.sourceRef)
    if (!targetEmployment) {
      blockers.add('EMPLOYMENT_NOT_SELECTED')
      continue
    }
    if (sourceDecision.action === 'NO_CHANGE'
      && (targetEmployment.employmentId !== existing.employmentId || targetEmployment.employmentRef !== undefined)) {
      blockers.add('INCOME_RELATIONSHIP_EMPLOYMENT_MISMATCH')
      continue
    }
    if (sourceDecision.action === 'LINK'
      && (targetEmployment.employmentId !== existing.employmentId || targetEmployment.employmentRef !== undefined)) {
      actions.push(action(input, person.sourceRef, 'LINK_INCOME_RELATIONSHIP', {
        sourceIncomeRef: income.sourceRef,
        targetEmployeeId: existing.employeeId,
        ...(targetEmployment.employmentId
          ? { targetEmploymentId: targetEmployment.employmentId }
          : { targetEmploymentRef: targetEmployment.employmentRef }),
        targetIncomeRelationshipId: existing.id,
        sourceRefs: [income.sourceRef],
        sourcePayrollTaxNumber: income.payrollTaxNumber,
        sourceIkvNumber: income.ikvNumber,
        sourceStartsOn: income.startsOn,
        sourceEndsOn: income.endsOn,
        preconditions: ['EMPLOYMENT_ASSOCIATION_EXPLICITLY_SELECTED', 'INCOME_RELATIONSHIP_SCOPE_REVALIDATED'],
      }))
    } else {
      actions.push(action(input, person.sourceRef, 'NO_CHANGE', {
        sourceIncomeRef: income.sourceRef,
        targetEmployeeId: existing.employeeId,
        targetEmploymentId: existing.employmentId ?? undefined,
        targetIncomeRelationshipId: existing.id,
        sourceRefs: [income.sourceRef],
        sourcePayrollTaxNumber: income.payrollTaxNumber,
        sourceIkvNumber: income.ikvNumber,
        sourceStartsOn: income.startsOn,
        sourceEndsOn: income.endsOn,
        preconditions: ['EXISTING_IKV_IDENTITY_MATCHES_SOURCE'],
      }))
    }
  }

  if (blockers.size > 0) {
    actions.length = 0
    actions.push(action(input, person.sourceRef, 'BLOCKED', {
      sourceRefs: [person.sourceRef],
      preconditions: [...blockers].sort(),
    }))
  }

  return {
    sourcePersonRef: person.sourceRef,
    decisionHash: confirmed?.decisionHash ?? null,
    decisionVersion: confirmed?.decisionVersion ?? null,
    confirmerUserId: confirmed?.confirmerUserId ?? null,
    status: blockers.size > 0 ? 'BLOCKED' : 'READY_FOR_REVIEW',
    actions: withActionDependencies(actions),
    warnings: [...warnings].sort(),
    blockers: [...blockers].sort(),
    sourceIncomeRefs: incomeRefs,
  }
}

export function buildPayrollFinalizationPlan(input: PayrollFinalizationPlannerInput): PayrollFinalizationPlan {
  const globalBlockers = new Set<PayrollFinalizationPlanBlocker>()
  const sourcePersonRefs = input.people.map(({ sourceRef }) => sourceRef)
  if (new Set(sourcePersonRefs).size !== sourcePersonRefs.length) globalBlockers.add('DUPLICATE_SOURCE_PERSON_REFERENCE')
  if (input.batch.sourceType !== 'LOONAANGIFTE_XML') globalBlockers.add('SOURCE_TYPE_UNSUPPORTED')
  if (!/^[a-f0-9]{64}$/i.test(input.batch.sourceHash) || !/^[a-f0-9]{64}$/i.test(input.batch.analysisHash)) {
    globalBlockers.add('SOURCE_PROVENANCE_UNVERIFIED')
  }
  if (!input.batch.officialSchemaValidated || !input.batch.schemaVersion) globalBlockers.add('OFFICIAL_SCHEMA_UNVERIFIED')
  if (!input.batch.sourceImmutable) globalBlockers.add('SOURCE_NOT_IMMUTABLE')
  if (!input.scopeInvariantMigrationApplied) globalBlockers.add('SCOPE_INVARIANT_MIGRATION_NOT_APPLIED')
  if (!input.contractVersion || !CONTROL02_APPROVED_CONTRACT_VERSIONS.includes(input.contractVersion)) {
    globalBlockers.add('SHARED_CONTRACT_PENDING')
  }
  globalBlockers.add('XML_FINALIZATION_DISABLED')

  const people = [...input.people]
    .sort((left, right) => left.sourceRef.localeCompare(right.sourceRef))
    .map((person) => {
      const planned = planPerson(input, person)
      if (globalBlockers.size === 0) return planned
      return {
        ...planned,
        status: planned.status === 'BLOCKED' ? 'BLOCKED' as const : 'READY_FOR_REVIEW' as const,
      }
    })
  const blockers = [...globalBlockers].sort()
  const body = {
    batchId: input.batch.batchId,
    tenantId: input.batch.tenantId,
    hrGroupId: input.batch.hrGroupId,
    administrationId: input.batch.administrationId,
    sourceHash: input.batch.sourceHash,
    analysisHash: input.batch.analysisHash,
    coreStateHash: input.currentCoreStateHash,
    schemaVersion: input.batch.schemaVersion,
    contractVersion: input.contractVersion,
    blockers,
    people,
  }

  return {
    batchId: input.batch.batchId,
    tenantId: input.batch.tenantId,
    hrGroupId: input.batch.hrGroupId,
    administrationId: input.batch.administrationId,
    sourceHash: input.batch.sourceHash,
    analysisHash: input.batch.analysisHash,
    coreStateHash: input.currentCoreStateHash,
    planHash: digest(body),
    status: blockers.length > 0 || people.some((person) => person.status === 'BLOCKED') ? 'BLOCKED' : 'READY_FOR_REVIEW',
    canExecute: false,
    contractVersion: input.contractVersion,
    schemaVersion: input.batch.schemaVersion,
    blockers,
    people,
  }
}
