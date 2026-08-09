import { createHash } from 'node:crypto'
import { z } from 'zod'
import {
  type AssignmentSelector,
  type ConditionNode,
  type FieldAccessMode,
  type FieldDefinition,
  type FieldType,
  type FormDefinition,
  type ProcessDefinitionDraft,
  type ProcessStep,
  type ProcessStepType,
  type ProcessTransition,
  processDefinitionDraftSchema,
} from './definition-schemas'
import { collectConditionFieldReferences, validateCondition } from './condition-evaluator'

export const PROCESS_DEFINITION_SCHEMA_VERSION = 1 as const
export const PROCESS_DEFINITION_COMPILER_VERSION = '1.0.0' as const

export type DefinitionCompileErrorCode =
  | 'SCHEMA_INVALID'
  | 'DEFAULT_LANGUAGE_REQUIRED'
  | 'DUPLICATE_LANGUAGE'
  | 'LANGUAGE_NOT_DECLARED'
  | 'MISSING_TRANSLATION'
  | 'DUPLICATE_PARTICIPANT_KEY'
  | 'DUPLICATE_FORM_KEY'
  | 'DUPLICATE_SECTION_KEY'
  | 'DUPLICATE_FIELD_KEY'
  | 'DUPLICATE_STEP_KEY'
  | 'DUPLICATE_TRANSITION_KEY'
  | 'DUPLICATE_FIELD_ACCESS_RULE'
  | 'FIELD_ACCESS_PARTICIPANT_UNKNOWN'
  | 'FIELD_ACCESS_MATRIX_INCOMPLETE'
  | 'FIELD_ACCESS_PERMISSION_MISMATCH'
  | 'FIELD_BINDING_UNKNOWN'
  | 'FIELD_BINDING_KIND_MISMATCH'
  | 'FIELD_BINDING_TYPE_MISMATCH'
  | 'FIELD_BINDING_WRITE_NOT_ALLOWED'
  | 'FIELD_PROPOSAL_NOT_WRITABLE'
  | 'FIELD_OPTIONS_REQUIRED'
  | 'FIELD_OPTIONS_UNEXPECTED'
  | 'INVALID_PARTICIPANT'
  | 'SELECTOR_FIELD_UNKNOWN'
  | 'SELECTOR_FIELD_TYPE_INVALID'
  | 'SELECTOR_DATE_FIELD_REQUIRED'
  | 'SELECTOR_DATE_FIELD_UNKNOWN'
  | 'SELECTOR_DATE_FIELD_TYPE_INVALID'
  | 'SELECTOR_DATE_FIELD_UNEXPECTED'
  | 'SELECTOR_PERMISSION_MISMATCH'
  | 'INVALID_PARTICIPANT_ASSIGNMENT'
  | 'STEP_PARTICIPANT_REQUIRED'
  | 'STEP_PARTICIPANT_UNKNOWN'
  | 'STEP_FORM_REQUIRED'
  | 'STEP_FORM_UNKNOWN'
  | 'END_STEP_OUTCOME_REQUIRED'
  | 'END_STEP_INVALID'
  | 'NON_END_STEP_HAS_OUTCOME'
  | 'DUPLICATE_STEP_ACTION'
  | 'STEP_ACTION_INVALID'
  | 'SLA_ESCALATION_PARTICIPANT_REQUIRED'
  | 'SLA_ESCALATION_PARTICIPANT_UNKNOWN'
  | 'SLA_ESCALATION_PARTICIPANT_INVALID'
  | 'TRANSITION_SOURCE_UNKNOWN'
  | 'TRANSITION_TARGET_UNKNOWN'
  | 'TRANSITION_SOURCE_TERMINAL'
  | 'TRANSITION_ACTION_NOT_ALLOWED'
  | 'RECOVERY_TRANSITION_INVALID'
  | 'START_STEP_UNKNOWN'
  | 'MISSING_END_STEP'
  | 'UNREACHABLE_STEP'
  | 'STEP_WITHOUT_EXIT'
  | 'END_STEP_HAS_EXIT'
  | 'ILLEGAL_CYCLE'
  | 'PARALLEL_FORK_INVALID'
  | 'PARALLEL_JOIN_INVALID'
  | 'CONDITION_REFERENCE_UNKNOWN'
  | 'CONDITION_SUBJECT_REFERENCE_UNKNOWN'
  | 'CONDITION_TYPE_MISMATCH'
  | 'CONDITION_NOT_ORDERABLE'
  | 'CONDITION_REFERENCES_HIDDEN_FIELD'
  | 'CONDITION_CIRCULAR_DEPENDENCY'
  | 'OUTPUT_FIELD_UNKNOWN'
  | 'OUTPUT_DOCUMENT_CATEGORY_REQUIRED'
  | 'SECURITY_ACCESS_ESCALATION'

export interface DefinitionCompileIssue {
  readonly code: DefinitionCompileErrorCode
  readonly path: ReadonlyArray<string | number>
  readonly message: string
}

export class DefinitionCompilerError extends Error {
  readonly code: DefinitionCompileErrorCode

  constructor(readonly issues: readonly DefinitionCompileIssue[]) {
    super(issues[0]?.code ?? 'SCHEMA_INVALID')
    this.name = 'DefinitionCompilerError'
    this.code = issues[0]?.code ?? 'SCHEMA_INVALID'
  }
}

export interface CompileProcessDefinitionOptions {
  readonly requiredLanguages?: readonly string[]
  readonly previousCompiledDefinition?: CompiledProcessDefinition
}

type DeepReadonly<T> = T extends readonly (infer Item)[]
  ? ReadonlyArray<DeepReadonly<Item>>
  : T extends object
    ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
    : T

type CompiledDefinitionContent = DeepReadonly<Omit<ProcessDefinitionDraft, 'status'> & { status: 'PUBLISHED' }>

export interface CompiledProcessDefinition {
  readonly kind: 'COMPILED_PROCESS_DEFINITION'
  readonly schemaVersion: typeof PROCESS_DEFINITION_SCHEMA_VERSION
  readonly compatibility: {
    readonly minimumReaderSchemaVersion: typeof PROCESS_DEFINITION_SCHEMA_VERSION
    readonly maximumReaderSchemaVersion: typeof PROCESS_DEFINITION_SCHEMA_VERSION
  }
  readonly compilerVersion: typeof PROCESS_DEFINITION_COMPILER_VERSION
  readonly hash: string
  readonly content: CompiledDefinitionContent
}

interface IndexedField {
  readonly definition: FieldDefinition
  readonly formIndex: number
  readonly sectionIndex: number
  readonly fieldIndex: number
  readonly formKey: string
  readonly path: ReadonlyArray<string | number>
}

interface FieldLikeForSecurity {
  readonly key: string
  readonly access: ReadonlyArray<{ readonly participantKey: string; readonly mode: FieldAccessMode }>
}

const knownDomainBindings: Readonly<Record<string, { readonly kind: 'DOMAIN_READ' | 'DOMAIN_PROPOSAL'; readonly type: FieldType }>> = {
  'employee.current.department': { kind: 'DOMAIN_READ', type: 'DEPARTMENT_REFERENCE' },
  'employee.current.job': { kind: 'DOMAIN_READ', type: 'JOB_REFERENCE' },
  'employment.organizationChange.targetDepartment': { kind: 'DOMAIN_PROPOSAL', type: 'DEPARTMENT_REFERENCE' },
  'employment.organizationChange.targetJob': { kind: 'DOMAIN_PROPOSAL', type: 'JOB_REFERENCE' },
  'employment.organizationChange.effectiveOn': { kind: 'DOMAIN_PROPOSAL', type: 'DATE' },
}

const humanStepTypes: ReadonlySet<ProcessStepType> = new Set(['FORM', 'DECISION', 'ACKNOWLEDGEMENT'])
const allowedActionsByStepType: Readonly<Record<ProcessStepType, readonly string[]>> = {
  FORM: ['SUBMIT', 'COMPLETE', 'REQUEST_CHANGES', 'CANCEL'],
  DECISION: ['APPROVE', 'REJECT', 'REQUEST_CHANGES', 'CANCEL'],
  ACKNOWLEDGEMENT: ['ACKNOWLEDGE', 'CANCEL'],
  AUTOMATED_COMMAND: ['COMPLETE', 'CANCEL'],
  WAIT_UNTIL: ['COMPLETE', 'CANCEL'],
  NOTIFICATION: ['COMPLETE', 'CANCEL'],
  DOCUMENT_OUTPUT: ['COMPLETE', 'CANCEL'],
  PARALLEL_FORK: ['COMPLETE', 'CANCEL'],
  PARALLEL_JOIN: ['COMPLETE', 'CANCEL'],
  END: [],
}

const accessModeRank: Readonly<Record<FieldAccessMode, number>> = {
  HIDDEN: 0,
  READ: 1,
  WRITE_OPTIONAL: 2,
  WRITE_REQUIRED: 3,
}

function issue(
  issues: DefinitionCompileIssue[],
  code: DefinitionCompileErrorCode,
  path: ReadonlyArray<string | number>,
  message: string,
): void {
  issues.push({ code, path, message })
}

function pathText(path: ReadonlyArray<string | number>): string {
  return path.map((part) => typeof part === 'number' ? `[${part}]` : part).join('.')
}

function schemaIssues(error: z.ZodError): DefinitionCompileIssue[] {
  return error.issues.map((item) => ({
    code: 'SCHEMA_INVALID',
    path: item.path.map((part) => typeof part === 'symbol' ? String(part) : part),
    message: item.message,
  }))
}

function normalizeLocalizedText(value: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)))
}

function sortByKey<T extends { key: string }>(values: readonly T[]): T[] {
  return [...values].sort((left, right) => left.key.localeCompare(right.key))
}

function normalizeField(field: FieldDefinition): FieldDefinition {
  return {
    ...field,
    label: normalizeLocalizedText(field.label),
    helpText: field.helpText ? normalizeLocalizedText(field.helpText) : undefined,
    access: [...field.access].sort((left, right) => left.participantKey.localeCompare(right.participantKey)),
    options: field.options?.map((option) => ({ ...option, label: normalizeLocalizedText(option.label) })),
  }
}

function normalizeForm(form: FormDefinition): FormDefinition {
  return {
    ...form,
    title: normalizeLocalizedText(form.title),
    description: form.description ? normalizeLocalizedText(form.description) : undefined,
    sections: sortByKey(form.sections).map((section) => ({
      ...section,
      title: normalizeLocalizedText(section.title),
      fields: sortByKey(section.fields).map(normalizeField),
    })),
  }
}

function normalizeDefinition(definition: ProcessDefinitionDraft): ProcessDefinitionDraft {
  return {
    ...definition,
    title: normalizeLocalizedText(definition.title),
    description: definition.description ? normalizeLocalizedText(definition.description) : undefined,
    enabledLanguages: [...definition.enabledLanguages].sort(),
    participants: sortByKey(definition.participants).map((participant) => ({
      ...participant,
      label: normalizeLocalizedText(participant.label),
    })),
    forms: sortByKey(definition.forms).map(normalizeForm),
    steps: sortByKey(definition.steps).map((step) => ({
      ...step,
      title: normalizeLocalizedText(step.title),
      allowedActions: [...step.allowedActions].sort(),
    })),
    transitions: sortByKey(definition.transitions).map((transition) => ({
      ...transition,
      label: normalizeLocalizedText(transition.label),
    })),
    output: definition.output ? {
      ...definition.output,
      title: normalizeLocalizedText(definition.output.title),
    } : undefined,
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value !== null && typeof value === 'object') {
    const record = value as Readonly<Record<string, unknown>>
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, canonicalize(record[key])]))
  }
  return value
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    Object.values(value as Readonly<Record<string, unknown>>).forEach((child) => deepFreeze(child))
  }
  return value
}

export function canonicalSerialize(value: unknown): string {
  const serialized = JSON.stringify(canonicalize(value))
  if (serialized === undefined) throw new Error('Unable to serialize process definition')
  return serialized
}

export function stableDefinitionHash(value: unknown): string {
  return createHash('sha256').update(canonicalSerialize(value), 'utf8').digest('hex')
}

function validateLocalizedText(
  value: Readonly<Record<string, string>>,
  requiredLanguages: readonly string[],
  path: ReadonlyArray<string | number>,
  issues: DefinitionCompileIssue[],
): void {
  for (const language of requiredLanguages) {
    if (!value[language]?.trim()) issue(issues, 'MISSING_TRANSLATION', [...path, language], `Missing translation for ${language}`)
  }
}

function validateLanguages(
  definition: ProcessDefinitionDraft,
  options: CompileProcessDefinitionOptions,
  issues: DefinitionCompileIssue[],
): readonly string[] {
  const declared = new Set<string>()
  definition.enabledLanguages.forEach((language, index) => {
    if (declared.has(language)) issue(issues, 'DUPLICATE_LANGUAGE', ['enabledLanguages', index], `Language is declared more than once: ${language}`)
    declared.add(language)
  })
  if (!declared.has('nl')) issue(issues, 'DEFAULT_LANGUAGE_REQUIRED', ['enabledLanguages'], 'Dutch (nl) must always be enabled')
  const required = options.requiredLanguages ? [...options.requiredLanguages] : [...definition.enabledLanguages]
  const requiredSeen = new Set<string>()
  required.forEach((language, index) => {
    if (requiredSeen.has(language)) issue(issues, 'DUPLICATE_LANGUAGE', ['requiredLanguages', index], `Language is required more than once: ${language}`)
    requiredSeen.add(language)
    if (!declared.has(language)) issue(issues, 'LANGUAGE_NOT_DECLARED', ['enabledLanguages'], `Required language is not declared: ${language}`)
  })
  if (!requiredSeen.has('nl')) issue(issues, 'DEFAULT_LANGUAGE_REQUIRED', ['requiredLanguages'], 'Dutch (nl) must always be required for publication')
  return [...requiredSeen].sort()
}

function indexDefinitions<T extends { key: string }>(
  values: readonly T[],
  pathKey: string,
  issues: DefinitionCompileIssue[],
  duplicateCode: DefinitionCompileErrorCode,
): Map<string, T> {
  const indexed = new Map<string, T>()
  values.forEach((value, index) => {
    if (indexed.has(value.key)) issue(issues, duplicateCode, [pathKey, index, 'key'], `Duplicate key: ${value.key}`)
    else indexed.set(value.key, value)
  })
  return indexed
}

function collectFields(
  forms: readonly FormDefinition[],
  issues: DefinitionCompileIssue[],
): Map<string, IndexedField> {
  const fields = new Map<string, IndexedField>()
  forms.forEach((form, formIndex) => {
    const sectionKeys = new Set<string>()
    form.sections.forEach((section, sectionIndex) => {
      if (sectionKeys.has(section.key)) issue(issues, 'DUPLICATE_SECTION_KEY', ['forms', formIndex, 'sections', sectionIndex, 'key'], `Duplicate section key: ${section.key}`)
      sectionKeys.add(section.key)
      section.fields.forEach((field, fieldIndex) => {
        const indexed: IndexedField = {
          definition: field,
          formIndex,
          sectionIndex,
          fieldIndex,
          formKey: form.key,
          path: ['forms', formIndex, 'sections', sectionIndex, 'fields', fieldIndex],
        }
        if (fields.has(field.key)) issue(issues, 'DUPLICATE_FIELD_KEY', [...indexed.path, 'key'], `Duplicate field key: ${field.key}`)
        else fields.set(field.key, indexed)
      })
    })
  })
  return fields
}

function selectorFieldKey(selector: AssignmentSelector): { key: string; expectedType: FieldType } | null {
  if (selector.type === 'EXPLICIT_PERSON' || selector.type === 'FORM_FIELD_PERSON') return { key: selector.personFieldKey, expectedType: 'EMPLOYEE_REFERENCE' }
  if (selector.type === 'MANAGEMENT_ROLE_ON_SELECTED_DEPARTMENT') return { key: selector.departmentFieldKey, expectedType: 'DEPARTMENT_REFERENCE' }
  return null
}

function validateParticipants(
  definition: ProcessDefinitionDraft,
  participants: Map<string, ProcessDefinitionDraft['participants'][number]>,
  fields: Map<string, IndexedField>,
  issues: DefinitionCompileIssue[],
): void {
  definition.participants.forEach((participant, index) => {
    const selectorReference = selectorFieldKey(participant.selector)
    if (selectorReference) {
      const field = fields.get(selectorReference.key)
      if (!field) issue(issues, 'SELECTOR_FIELD_UNKNOWN', ['participants', index, 'selector'], `Selector field does not exist: ${selectorReference.key}`)
      else if (field.definition.type !== selectorReference.expectedType) issue(issues, 'SELECTOR_FIELD_TYPE_INVALID', ['participants', index, 'selector'], `Selector field has type ${field.definition.type}, expected ${selectorReference.expectedType}`)
    }
    if (participant.selector.type === 'PERMISSION_WORK_QUEUE' && participant.selector.permission !== participant.permission) issue(issues, 'SELECTOR_PERMISSION_MISMATCH', ['participants', index, 'selector', 'permission'], 'Queue selector permission must match participant permission')
    const isQueue = participant.selector.type === 'PERMISSION_WORK_QUEUE' || participant.selector.type === 'PROCESS_OWNER_QUEUE'
    if (isQueue ? participant.assignmentMode === 'EXACTLY_ONE' : participant.assignmentMode !== 'EXACTLY_ONE') {
      issue(issues, 'INVALID_PARTICIPANT_ASSIGNMENT', ['participants', index, 'assignmentMode'], 'Queue selectors require ANY_ONE or ALL; person selectors require EXACTLY_ONE')
    }
    if (participant.selector.resolutionDatePolicy === 'FIXED_DATE_FIELD') {
      if (!participant.selector.fixedDateFieldKey) issue(issues, 'SELECTOR_DATE_FIELD_REQUIRED', ['participants', index, 'selector', 'fixedDateFieldKey'], 'FIXED_DATE_FIELD requires a date field')
      else {
        const dateField = fields.get(participant.selector.fixedDateFieldKey)
        if (!dateField) issue(issues, 'SELECTOR_DATE_FIELD_UNKNOWN', ['participants', index, 'selector', 'fixedDateFieldKey'], `Selector date field does not exist: ${participant.selector.fixedDateFieldKey}`)
        else if (dateField.definition.type !== 'DATE' && dateField.definition.type !== 'DATETIME') issue(issues, 'SELECTOR_DATE_FIELD_TYPE_INVALID', ['participants', index, 'selector', 'fixedDateFieldKey'], 'Selector date field must be DATE or DATETIME')
      }
    } else if (participant.selector.fixedDateFieldKey) {
      issue(issues, 'SELECTOR_DATE_FIELD_UNEXPECTED', ['participants', index, 'selector', 'fixedDateFieldKey'], 'fixedDateFieldKey is only allowed with FIXED_DATE_FIELD')
    }
    if (!participants.has(participant.key)) issue(issues, 'INVALID_PARTICIPANT', ['participants', index, 'key'], `Unknown participant: ${participant.key}`)
  })
}

function accessRules(field: FieldDefinition, fieldPath: ReadonlyArray<string | number>, participantKeys: ReadonlySet<string>, issues: DefinitionCompileIssue[]): Map<string, FieldAccessMode> {
  const access = new Map<string, FieldAccessMode>()
  field.access.forEach((rule, index) => {
    if (!participantKeys.has(rule.participantKey)) issue(issues, 'FIELD_ACCESS_PARTICIPANT_UNKNOWN', [...fieldPath, 'access', index, 'participantKey'], `Unknown participant: ${rule.participantKey}`)
    if (access.has(rule.participantKey)) issue(issues, 'DUPLICATE_FIELD_ACCESS_RULE', [...fieldPath, 'access', index, 'participantKey'], `Duplicate access rule: ${rule.participantKey}`)
    else access.set(rule.participantKey, rule.mode)
  })
  for (const participantKey of participantKeys) if (!access.has(participantKey)) issue(issues, 'FIELD_ACCESS_MATRIX_INCOMPLETE', [...fieldPath, 'access'], `Missing access rule for participant: ${participantKey}`)
  return access
}

function validateBinding(field: FieldDefinition, fieldPath: ReadonlyArray<string | number>, issues: DefinitionCompileIssue[]): void {
  const binding = field.binding
  if (binding.kind === 'DOMAIN_READ' || binding.kind === 'DOMAIN_PROPOSAL') {
    const known = knownDomainBindings[binding.key]
    if (!known) issue(issues, 'FIELD_BINDING_UNKNOWN', [...fieldPath, 'binding', 'key'], `Unknown domain binding: ${binding.key}`)
    else {
      if (known.kind !== binding.kind) issue(issues, 'FIELD_BINDING_KIND_MISMATCH', [...fieldPath, 'binding', 'kind'], `Binding ${binding.key} must use ${known.kind}`)
      if (known.type !== field.type) issue(issues, 'FIELD_BINDING_TYPE_MISMATCH', [...fieldPath, 'type'], `Binding ${binding.key} requires ${known.type}`)
    }
  }
}

function validateFieldOptions(field: FieldDefinition, fieldPath: ReadonlyArray<string | number>, issues: DefinitionCompileIssue[]): void {
  const isSelect = field.type === 'SINGLE_SELECT' || field.type === 'MULTI_SELECT'
  if (isSelect && !field.options) issue(issues, 'FIELD_OPTIONS_REQUIRED', [...fieldPath, 'options'], 'Select fields require options')
  if (!isSelect && field.options) issue(issues, 'FIELD_OPTIONS_UNEXPECTED', [...fieldPath, 'options'], 'Only select fields may define options')
  if (field.options) {
    const values = new Set<string>()
    field.options.forEach((option, index) => {
      if (values.has(option.value)) issue(issues, 'FIELD_OPTIONS_UNEXPECTED', [...fieldPath, 'options', index, 'value'], `Duplicate option value: ${option.value}`)
      values.add(option.value)
    })
  }
}

function conditionIssues(
  condition: ConditionNode,
  fieldTypes: ReadonlyMap<string, FieldType>,
  path: ReadonlyArray<string | number>,
  issues: DefinitionCompileIssue[],
): readonly string[] {
  validateCondition(condition, { fields: fieldTypes }, path).forEach((item) => {
    issue(issues, item.code, item.path, item.message)
  })
  return collectConditionFieldReferences(condition)
}

function validateFieldConditions(
  forms: readonly FormDefinition[],
  participantKeys: ReadonlySet<string>,
  fields: Map<string, IndexedField>,
  issues: DefinitionCompileIssue[],
): void {
  forms.forEach((form, formIndex) => {
    const formFields = new Map<string, FieldDefinition>()
    form.sections.forEach((section) => section.fields.forEach((field) => formFields.set(field.key, field)))
    const dependencies = new Map<string, Set<string>>()
    form.sections.forEach((section, sectionIndex) => section.fields.forEach((field, fieldIndex) => {
      const indexed = fields.get(field.key)
      if (!indexed) return
      const fieldPath = ['forms', formIndex, 'sections', sectionIndex, 'fields', fieldIndex] as const
      const access = accessRules(field, fieldPath, participantKeys, issues)
      validateBinding(field, fieldPath, issues)
      validateFieldOptions(field, fieldPath, issues)
      const references = new Set<string>()
      const conditions: ReadonlyArray<readonly [string, ConditionNode | undefined]> = [
        ['visibilityCondition', field.visibilityCondition],
        ['requiredCondition', field.requiredCondition],
      ]
      conditions.forEach(([conditionName, condition]) => {
        if (!condition) return
        const conditionPath = [...fieldPath, conditionName]
        conditionIssues(condition, new Map([...formFields].map(([key, value]) => [key, value.type])), conditionPath, issues).forEach((reference) => references.add(reference))
        if (references.has(field.key)) issue(issues, 'CONDITION_CIRCULAR_DEPENDENCY', conditionPath, `Field condition references itself: ${field.key}`)
        for (const reference of collectConditionFieldReferences(condition)) {
          const referencedField = formFields.get(reference)
          if (!referencedField) continue
          const referencedIndexed = fields.get(reference)
          if (!referencedIndexed) continue
          const referencedAccess = accessRules(referencedField, referencedIndexed.path, participantKeys, issues)
          for (const participantKey of participantKeys) {
            if (access.get(participantKey) !== 'HIDDEN' && referencedAccess.get(participantKey) === 'HIDDEN') issue(issues, 'CONDITION_REFERENCES_HIDDEN_FIELD', [...conditionPath, 'fieldKey'], `Visible field condition depends on hidden field: ${reference}`)
          }
        }
      })
      if (references.size > 0) dependencies.set(field.key, references)
    }))

    const states = new Map<string, 'unvisited' | 'visiting' | 'visited'>()
    const visit = (fieldKey: string, stack: readonly string[]): void => {
      states.set(fieldKey, 'visiting')
      for (const dependency of dependencies.get(fieldKey) ?? []) {
        if (!formFields.has(dependency)) continue
        const state = states.get(dependency) ?? 'unvisited'
        if (state === 'visiting') {
          const cycle = [...stack, fieldKey, dependency]
          const field = fields.get(fieldKey)
          const conditionPath = field ? [...field.path, 'visibilityCondition'] : ['forms', formIndex, 'sections']
          issue(issues, 'CONDITION_CIRCULAR_DEPENDENCY', conditionPath, `Circular field condition dependency: ${cycle.join(' -> ')}`)
        } else if (state === 'unvisited') visit(dependency, [...stack, fieldKey])
      }
      states.set(fieldKey, 'visited')
    }
    for (const fieldKey of dependencies.keys()) if ((states.get(fieldKey) ?? 'unvisited') === 'unvisited') visit(fieldKey, [])
  })
}

function validateSteps(
  definition: ProcessDefinitionDraft,
  participants: ReadonlyMap<string, ProcessDefinitionDraft['participants'][number]>,
  forms: ReadonlyMap<string, FormDefinition>,
  issues: DefinitionCompileIssue[],
): Map<string, ProcessStep> {
  const steps = indexDefinitions(definition.steps, 'steps', issues, 'DUPLICATE_STEP_KEY')
  definition.steps.forEach((step, index) => {
    const path = ['steps', index] as const
    const allowed = new Set<string>()
    step.allowedActions.forEach((action, actionIndex) => {
      if (allowed.has(action)) issue(issues, 'DUPLICATE_STEP_ACTION', [...path, 'allowedActions', actionIndex], `Duplicate action: ${action}`)
      allowed.add(action)
      if (!allowedActionsByStepType[step.type].includes(action)) issue(issues, 'STEP_ACTION_INVALID', [...path, 'allowedActions', actionIndex], `${action} is not valid for ${step.type}`)
    })
    if (humanStepTypes.has(step.type) && !step.participantKey) issue(issues, 'STEP_PARTICIPANT_REQUIRED', [...path, 'participantKey'], `${step.type} steps require a participant`)
    if (step.participantKey && !participants.has(step.participantKey)) issue(issues, 'STEP_PARTICIPANT_UNKNOWN', [...path, 'participantKey'], `Unknown participant: ${step.participantKey}`)
    if (step.formKey && !forms.has(step.formKey)) issue(issues, 'STEP_FORM_UNKNOWN', [...path, 'formKey'], `Unknown form: ${step.formKey}`)
    if (step.type === 'FORM' && !step.formKey) issue(issues, 'STEP_FORM_REQUIRED', [...path, 'formKey'], 'FORM steps require a form')
    if (step.type === 'END') {
      if (!step.terminalOutcome) issue(issues, 'END_STEP_OUTCOME_REQUIRED', [...path, 'terminalOutcome'], 'END steps require an outcome')
      if (step.participantKey || step.formKey || step.allowedActions.length > 0) issue(issues, 'END_STEP_INVALID', path, 'END steps cannot have participants, forms, or actions')
    } else if (step.terminalOutcome) issue(issues, 'NON_END_STEP_HAS_OUTCOME', [...path, 'terminalOutcome'], 'Only END steps may have a terminal outcome')
    if (step.sla?.onBreach === 'ESCALATE' && !step.sla.escalationParticipantKey) issue(issues, 'SLA_ESCALATION_PARTICIPANT_REQUIRED', [...path, 'sla', 'escalationParticipantKey'], 'Escalating SLAs require a participant')
    if (step.sla?.onBreach !== 'ESCALATE' && step.sla?.escalationParticipantKey) issue(issues, 'SLA_ESCALATION_PARTICIPANT_INVALID', [...path, 'sla', 'escalationParticipantKey'], 'Only escalating SLAs may define an escalation participant')
    if (step.sla?.escalationParticipantKey && !participants.has(step.sla.escalationParticipantKey)) issue(issues, 'SLA_ESCALATION_PARTICIPANT_UNKNOWN', [...path, 'sla', 'escalationParticipantKey'], `Unknown escalation participant: ${step.sla.escalationParticipantKey}`)
  })
  return steps
}

function validateTransitions(
  definition: ProcessDefinitionDraft,
  steps: ReadonlyMap<string, ProcessStep>,
  fields: ReadonlyMap<string, IndexedField>,
  issues: DefinitionCompileIssue[],
): { readonly outgoing: Map<string, ProcessTransition[]>; readonly incoming: Map<string, ProcessTransition[]> } {
  const transitionKeys = new Set<string>()
  const outgoing = new Map<string, ProcessTransition[]>()
  const incoming = new Map<string, ProcessTransition[]>()
  const allFieldTypes = new Map<string, FieldType>([...fields].map(([key, field]) => [key, field.definition.type]))
  definition.transitions.forEach((transition, index) => {
    const path = ['transitions', index] as const
    if (transitionKeys.has(transition.key)) issue(issues, 'DUPLICATE_TRANSITION_KEY', [...path, 'key'], `Duplicate transition key: ${transition.key}`)
    transitionKeys.add(transition.key)
    const source = steps.get(transition.fromStepKey)
    const target = steps.get(transition.toStepKey)
    if (!source) issue(issues, 'TRANSITION_SOURCE_UNKNOWN', [...path, 'fromStepKey'], `Unknown transition source: ${transition.fromStepKey}`)
    if (!target) issue(issues, 'TRANSITION_TARGET_UNKNOWN', [...path, 'toStepKey'], `Unknown transition target: ${transition.toStepKey}`)
    if (source?.type === 'END') issue(issues, 'TRANSITION_SOURCE_TERMINAL', [...path, 'fromStepKey'], 'END steps cannot have transitions')
    if (source && !source.allowedActions.includes(transition.action)) issue(issues, 'TRANSITION_ACTION_NOT_ALLOWED', [...path, 'action'], `${transition.action} is not enabled on ${source.key}`)
    if (transition.kind === 'RECOVERY' && transition.action !== 'REQUEST_CHANGES') issue(issues, 'RECOVERY_TRANSITION_INVALID', [...path, 'kind'], 'Recovery transitions must use REQUEST_CHANGES')
    if (transition.condition) conditionIssues(transition.condition, allFieldTypes, [...path, 'condition'], issues)
    if (source) outgoing.set(source.key, [...(outgoing.get(source.key) ?? []), transition])
    if (target) incoming.set(target.key, [...(incoming.get(target.key) ?? []), transition])
  })
  return { outgoing, incoming }
}

function validateGraph(
  definition: ProcessDefinitionDraft,
  steps: ReadonlyMap<string, ProcessStep>,
  graph: { readonly outgoing: ReadonlyMap<string, readonly ProcessTransition[]>; readonly incoming: ReadonlyMap<string, readonly ProcessTransition[]> },
  issues: DefinitionCompileIssue[],
): void {
  if (!steps.has(definition.startStepKey)) issue(issues, 'START_STEP_UNKNOWN', ['startStepKey'], `Unknown start step: ${definition.startStepKey}`)
  const endSteps = definition.steps.filter((step) => step.type === 'END')
  if (endSteps.length === 0) issue(issues, 'MISSING_END_STEP', ['steps'], 'At least one END step is required')

  const reachable = new Set<string>()
  const queue = steps.has(definition.startStepKey) ? [definition.startStepKey] : []
  while (queue.length > 0) {
    const stepKey = queue.shift()
    if (!stepKey || reachable.has(stepKey)) continue
    reachable.add(stepKey)
    for (const transition of graph.outgoing.get(stepKey) ?? []) if (!reachable.has(transition.toStepKey)) queue.push(transition.toStepKey)
  }
  definition.steps.forEach((step, index) => {
    const transitions = graph.outgoing.get(step.key) ?? []
    if (!reachable.has(step.key)) issue(issues, 'UNREACHABLE_STEP', ['steps', index, 'key'], `Step is unreachable: ${step.key}`)
    if (step.type === 'END' && transitions.length > 0) issue(issues, 'END_STEP_HAS_EXIT', ['steps', index, 'key'], 'END steps must not have exits')
    if (step.type !== 'END' && transitions.length === 0) issue(issues, 'STEP_WITHOUT_EXIT', ['steps', index, 'key'], `Non-terminal step has no exit: ${step.key}`)
    if (step.type === 'PARALLEL_FORK' && new Set(transitions.map((transition) => transition.toStepKey)).size < 2) issue(issues, 'PARALLEL_FORK_INVALID', ['steps', index, 'key'], 'Parallel forks require at least two distinct branches')
    if (step.type === 'PARALLEL_JOIN' && new Set((graph.incoming.get(step.key) ?? []).map((transition) => transition.fromStepKey)).size < 2) issue(issues, 'PARALLEL_JOIN_INVALID', ['steps', index, 'key'], 'Parallel joins require at least two incoming branches')
  })

  const states = new Map<string, 'unvisited' | 'visiting' | 'visited'>()
  const visit = (stepKey: string): void => {
    states.set(stepKey, 'visiting')
    for (const transition of graph.outgoing.get(stepKey) ?? []) {
      const state = states.get(transition.toStepKey) ?? 'unvisited'
      if (state === 'visiting' && transition.kind !== 'RECOVERY') issue(issues, 'ILLEGAL_CYCLE', ['transitions', definition.transitions.findIndex((item) => item.key === transition.key), 'kind'], 'Cycles require an explicit RECOVERY transition')
      else if (state === 'unvisited') visit(transition.toStepKey)
    }
    states.set(stepKey, 'visited')
  }
  if (steps.has(definition.startStepKey)) visit(definition.startStepKey)
}

function validateOutput(
  definition: ProcessDefinitionDraft,
  fields: ReadonlyMap<string, IndexedField>,
  issues: DefinitionCompileIssue[],
): void {
  if (!definition.output) return
  definition.output.fieldKeys.forEach((fieldKey, index) => {
    if (!fields.has(fieldKey)) issue(issues, 'OUTPUT_FIELD_UNKNOWN', ['output', 'fieldKeys', index], `Unknown output field: ${fieldKey}`)
  })
  if ((definition.output.format === 'PDF' || definition.output.format === 'DOCX') && !definition.output.dossierCategoryKey) issue(issues, 'OUTPUT_DOCUMENT_CATEGORY_REQUIRED', ['output', 'dossierCategoryKey'], 'Document outputs require a dossier category')
}

function fieldLikeMap(content: CompiledDefinitionContent): Map<string, FieldLikeForSecurity> {
  const fields = new Map<string, FieldLikeForSecurity>()
  content.forms.forEach((form) => form.sections.forEach((section) => section.fields.forEach((field) => {
    fields.set(field.key, { key: field.key, access: field.access.map((rule) => ({ participantKey: rule.participantKey, mode: rule.mode })) })
  })))
  return fields
}

function validateSecurityCompatibility(
  candidate: CompiledDefinitionContent,
  previous: CompiledProcessDefinition | undefined,
  issues: DefinitionCompileIssue[],
): void {
  if (!previous) return
  const previousFields = fieldLikeMap(previous.content)
  const candidateFields = fieldLikeMap(candidate)
  for (const previousField of previousFields.values()) {
    const candidateField = candidateFields.get(previousField.key)
    if (!candidateField) continue
    for (const previousAccess of previousField.access) {
      const candidateAccess = candidateField.access.find((rule) => rule.participantKey === previousAccess.participantKey)
      if (candidateAccess && accessModeRank[candidateAccess.mode] > accessModeRank[previousAccess.mode]) issue(issues, 'SECURITY_ACCESS_ESCALATION', ['forms', previousField.key, 'access', previousAccess.participantKey], `Access for ${previousField.key}/${previousAccess.participantKey} became more permissive`)
    }
  }
}

export function compileProcessDefinition(input: unknown, options: CompileProcessDefinitionOptions = {}): CompiledProcessDefinition {
  const parsed = processDefinitionDraftSchema.safeParse(input)
  if (!parsed.success) throw new DefinitionCompilerError(schemaIssues(parsed.error))

  const definition = parsed.data
  const issues: DefinitionCompileIssue[] = []
  const requiredLanguages = validateLanguages(definition, options, issues)
  validateLocalizedText(definition.title, requiredLanguages, ['title'], issues)
  if (definition.description) validateLocalizedText(definition.description, requiredLanguages, ['description'], issues)
  definition.participants.forEach((participant, index) => validateLocalizedText(participant.label, requiredLanguages, ['participants', index, 'label'], issues))
  definition.forms.forEach((form, formIndex) => {
    validateLocalizedText(form.title, requiredLanguages, ['forms', formIndex, 'title'], issues)
    if (form.description) validateLocalizedText(form.description, requiredLanguages, ['forms', formIndex, 'description'], issues)
    form.sections.forEach((section, sectionIndex) => {
      validateLocalizedText(section.title, requiredLanguages, ['forms', formIndex, 'sections', sectionIndex, 'title'], issues)
      section.fields.forEach((field, fieldIndex) => {
        validateLocalizedText(field.label, requiredLanguages, ['forms', formIndex, 'sections', sectionIndex, 'fields', fieldIndex, 'label'], issues)
        if (field.helpText) validateLocalizedText(field.helpText, requiredLanguages, ['forms', formIndex, 'sections', sectionIndex, 'fields', fieldIndex, 'helpText'], issues)
        field.options?.forEach((option, optionIndex) => validateLocalizedText(option.label, requiredLanguages, ['forms', formIndex, 'sections', sectionIndex, 'fields', fieldIndex, 'options', optionIndex, 'label'], issues))
      })
    })
  })
  definition.steps.forEach((step, index) => validateLocalizedText(step.title, requiredLanguages, ['steps', index, 'title'], issues))
  definition.transitions.forEach((transition, index) => validateLocalizedText(transition.label, requiredLanguages, ['transitions', index, 'label'], issues))
  if (definition.output) validateLocalizedText(definition.output.title, requiredLanguages, ['output', 'title'], issues)

  const participants = indexDefinitions(definition.participants, 'participants', issues, 'DUPLICATE_PARTICIPANT_KEY')
  const forms = indexDefinitions(definition.forms, 'forms', issues, 'DUPLICATE_FORM_KEY')
  const fields = collectFields(definition.forms, issues)
  validateParticipants(definition, participants, fields, issues)
  validateFieldConditions(definition.forms, new Set(participants.keys()), fields, issues)
  const steps = validateSteps(definition, participants, forms, issues)
  const graph = validateTransitions(definition, steps, fields, issues)
  validateGraph(definition, steps, graph, issues)
  validateOutput(definition, fields, issues)

  if (issues.length > 0) {
    issues.sort((left, right) => {
      const pathDifference = pathText(left.path).localeCompare(pathText(right.path))
      return pathDifference !== 0 ? pathDifference : left.code.localeCompare(right.code)
    })
    throw new DefinitionCompilerError(issues)
  }

  const normalized = normalizeDefinition(definition)
  const content = { ...normalized, status: 'PUBLISHED' as const }
  const compiledContent = content as CompiledDefinitionContent
  const compatibilityIssues: DefinitionCompileIssue[] = []
  validateSecurityCompatibility(compiledContent, options.previousCompiledDefinition, compatibilityIssues)
  if (compatibilityIssues.length > 0) throw new DefinitionCompilerError(compatibilityIssues)
  return deepFreeze({
    kind: 'COMPILED_PROCESS_DEFINITION',
    schemaVersion: PROCESS_DEFINITION_SCHEMA_VERSION,
    compatibility: {
      minimumReaderSchemaVersion: PROCESS_DEFINITION_SCHEMA_VERSION,
      maximumReaderSchemaVersion: PROCESS_DEFINITION_SCHEMA_VERSION,
    },
    compilerVersion: PROCESS_DEFINITION_COMPILER_VERSION,
    hash: stableDefinitionHash(compiledContent),
    content: deepFreeze(compiledContent),
  })
}
