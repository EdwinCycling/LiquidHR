import { describe, expect, it } from 'vitest'
import { evaluateCondition } from './condition-evaluator'
import {
  compileProcessDefinition,
  DefinitionCompilerError,
  stableDefinitionHash,
} from './definition-compiler'
import { processDefinitionDraftSchema, type FieldDefinition, type ProcessDefinitionDraft } from './definition-schemas'
import { documentAcknowledgementFixture } from './fixtures/document-acknowledgement'
import { createTrainingRequestExampleDraft } from './studio-draft-factories'
import { internalTransferFixture } from './fixtures/internal-transfer'

function copyFixture(): ProcessDefinitionDraft {
  return structuredClone(internalTransferFixture)
}

function fieldByKey(definition: ProcessDefinitionDraft, key: string): FieldDefinition {
  for (const form of definition.forms) {
    for (const section of form.sections) {
      const field = section.fields.find((candidate) => candidate.key === key)
      if (field) return field
    }
  }
  throw new Error(`Fixture field not found: ${key}`)
}

function compileFailure(
  definition: unknown,
  code: string,
  pathPrefix: ReadonlyArray<string | number>,
): void {
  let caught: unknown
  try {
    compileProcessDefinition(definition)
  } catch (error) {
    caught = error
  }
  expect(caught).toBeInstanceOf(DefinitionCompilerError)
  const compilerError = caught as DefinitionCompilerError
  const matchingIssue = compilerError.issues.find((issue) => issue.code === code)
  expect(matchingIssue).toBeDefined()
  expect(matchingIssue?.path.slice(0, pathPrefix.length)).toEqual(pathPrefix)
}

describe('process definition compiler', () => {
  it('compiles the internal transfer showcase deterministically', () => {
    expect(processDefinitionDraftSchema.safeParse(internalTransferFixture).success).toBe(true)
    const first = compileProcessDefinition(internalTransferFixture)
    const reordered = copyFixture()
    reordered.participants.reverse()
    reordered.forms.reverse()
    reordered.forms[0].sections[0].fields.reverse()
    reordered.transitions.reverse()
    const second = compileProcessDefinition(reordered)

    expect(first.content.status).toBe('PUBLISHED')
    expect(first.schemaVersion).toBe(1)
    expect(first.compatibility).toEqual({ minimumReaderSchemaVersion: 1, maximumReaderSchemaVersion: 1 })
    expect(first.hash).toMatch(/^[a-f0-9]{64}$/)
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first.content)).toBe(true)
    expect(second.hash).toBe(first.hash)
    expect(stableDefinitionHash({ b: 2, a: 1 })).toBe(stableDefinitionHash({ a: 1, b: 2 }))
  })

  it('compiles the document acknowledgement recipe with its document binding and PDF output', () => {
    expect(processDefinitionDraftSchema.safeParse(documentAcknowledgementFixture).success).toBe(true)
    const compiled = compileProcessDefinition(documentAcknowledgementFixture)
    expect(compiled.content.steps.find((step) => step.key === 'acknowledge')?.type).toBe('ACKNOWLEDGEMENT')
    expect(compiled.content.output?.dossierCategoryKey).toBe('process-document-acknowledgement')
  })

  it('evaluates only the typed condition AST', () => {
    const condition = {
      operator: 'and' as const,
      conditions: [
        { operator: 'equals' as const, left: { kind: 'FIELD' as const, fieldKey: 'target-department' }, right: { kind: 'LITERAL' as const, value: 'dept-2' } },
        { operator: 'greaterThan' as const, left: { kind: 'FIELD' as const, fieldKey: 'effective-on' }, right: { kind: 'LITERAL' as const, value: '2026-01-01' } },
      ],
    }
    expect(evaluateCondition(condition, {
      fields: { 'target-department': 'dept-2', 'effective-on': '2026-07-01' },
      subject: {},
    })).toBe(true)
    expect(evaluateCondition(condition, {
      fields: { 'target-department': 'dept-3', 'effective-on': '2026-07-01' },
      subject: {},
    })).toBe(false)
  })

  it('evaluates empty and non-empty multi-select sources with the shared condition evaluator', () => {
    const empty = { operator: 'isEmpty' as const, operand: { kind: 'FIELD' as const, fieldKey: 'training-topics' } }
    const filled = { operator: 'isNotEmpty' as const, operand: { kind: 'FIELD' as const, fieldKey: 'training-topics' } }
    expect(evaluateCondition(empty, { fields: { 'training-topics': [] }, subject: {} })).toBe(true)
    expect(evaluateCondition(filled, { fields: { 'training-topics': ['leadership'] }, subject: {} })).toBe(true)
  })

  it('keeps a complementary condition pair through the versioned compile and save/reopen contract', () => {
    const definition = createTrainingRequestExampleDraft({ key: 'opleiding-aanvragen', title: { nl: 'Opleidingsaanvraag', en: 'Training request' }, description: { nl: 'Aanvraag en beoordeling.', en: 'Request and review.' } })
    const condition = { operator: 'greaterThan' as const, left: { kind: 'FIELD' as const, fieldKey: 'training-expected-cost' }, right: { kind: 'LITERAL' as const, value: 1000 } }
    const route = definition.transitions.find((candidate) => candidate.key === 'request-submit')
    if (!route) throw new Error('Training request route not found')
    definition.transitions = definition.transitions.filter((candidate) => candidate.key !== route.key)
    definition.transitions.push(
      { ...route, toStepKey: 'hr-processing', condition },
      { ...route, key: 'request-submit-otherwise', toStepKey: 'manager-review', condition: { operator: 'not', condition } },
    )
    const compiled = compileProcessDefinition(definition)
    const savedAndReopened = processDefinitionDraftSchema.parse(JSON.parse(JSON.stringify(definition)))
    const reopened = compileProcessDefinition(savedAndReopened)

    expect(reopened.hash).toBe(compiled.hash)
    expect(reopened.content.transitions.find((candidate) => candidate.key === 'request-submit')?.condition).toEqual(condition)
    expect(Object.isFrozen(reopened.content.transitions.find((candidate) => candidate.key === 'request-submit')?.condition)).toBe(true)
  })

  it('rejects conditional references to removed fields and route destinations', () => {
    const definition = createTrainingRequestExampleDraft({ key: 'opleiding-aanvragen', title: { nl: 'Opleidingsaanvraag', en: 'Training request' }, description: { nl: 'Aanvraag en beoordeling.', en: 'Request and review.' } })
    definition.transitions[0] = { ...definition.transitions[0]!, condition: { operator: 'greaterThan', left: { kind: 'FIELD', fieldKey: 'training-expected-cost' }, right: { kind: 'LITERAL', value: 1000 } } }
    definition.forms[0]!.sections[0]!.fields = definition.forms[0]!.sections[0]!.fields.filter((field) => field.key !== 'training-expected-cost')
    compileFailure(definition, 'CONDITION_REFERENCE_UNKNOWN', ['transitions'])

    const missingDestination = createTrainingRequestExampleDraft({ key: 'opleiding-aanvragen', title: { nl: 'Opleidingsaanvraag', en: 'Training request' }, description: { nl: 'Aanvraag en beoordeling.', en: 'Request and review.' } })
    missingDestination.transitions[0] = { ...missingDestination.transitions[0]!, toStepKey: 'removed-step' }
    compileFailure(missingDestination, 'TRANSITION_TARGET_UNKNOWN', ['transitions'])
  })
  it('allows empty draft sections but blocks a form with no fields from publishing', () => {
    const definition = copyFixture()
    definition.forms[0].sections.forEach((section) => { section.fields = [] })
    expect(processDefinitionDraftSchema.safeParse(definition).success).toBe(true)
    compileFailure(definition, 'FORM_WITHOUT_FIELDS', ['forms', 0, 'sections'])
  })

  it('rejects an unreachable step', () => {
    const definition = copyFixture()
    definition.steps.push({ key: 'orphan', type: 'FORM', title: { nl: 'Los', en: 'Orphan' }, participantKey: 'initiator', formKey: 'internal-transfer-form', allowedActions: ['SUBMIT'] })
    compileFailure(definition, 'UNREACHABLE_STEP', ['steps'])
  })

  it('rejects a cycle without an explicit recovery edge', () => {
    const definition = copyFixture()
    const transition = definition.transitions.find((candidate) => candidate.key === 'source-changes')
    if (!transition) throw new Error('Fixture transition not found')
    transition.kind = 'FORWARD'
    compileFailure(definition, 'ILLEGAL_CYCLE', ['transitions'])
  })

  it('rejects a graph without an END step', () => {
    const definition = copyFixture()
    definition.steps = definition.steps.filter((step) => step.type !== 'END')
    compileFailure(definition, 'MISSING_END_STEP', ['steps'])
  })

  it('rejects an unknown domain binding', () => {
    const definition = copyFixture()
    const field = fieldByKey(definition, 'current-department')
    field.binding = { kind: 'DOMAIN_READ', key: 'employee.current.unknown' }
    compileFailure(definition, 'FIELD_BINDING_UNKNOWN', ['forms'])
  })

  it('accepts registered computed bindings when the field is read-only', () => {
    const definition = copyFixture()
    const field = fieldByKey(definition, 'reason')
    field.type = 'SHORT_TEXT'
    field.binding = { kind: 'COMPUTED', formulaKey: 'subject-display-name' }
    field.access = field.access.map((rule) => ({ ...rule, mode: rule.mode === 'WRITE_OPTIONAL' ? 'READ' as const : rule.mode }))
    expect(() => compileProcessDefinition(definition)).not.toThrow()
  })

  it('rejects writable access for read and computed bindings', () => {
    const definition = copyFixture()
    const field = fieldByKey(definition, 'current-department')
    field.access = field.access.map((rule) => rule.participantKey === 'initiator' ? { ...rule, mode: 'WRITE_OPTIONAL' as const } : rule)
    compileFailure(definition, 'FIELD_BINDING_WRITE_NOT_ALLOWED', ['forms'])
  })

  it('rejects a proposal without a writable participant', () => {
    const definition = copyFixture()
    const field = fieldByKey(definition, 'target-department')
    field.access = field.access.map((rule) => ({ ...rule, mode: 'READ' as const }))
    compileFailure(definition, 'FIELD_PROPOSAL_NOT_WRITABLE', ['forms'])
  })

  it('rejects a selector that points to an unknown field', () => {
    const definition = copyFixture()
    const participant = definition.participants.find((candidate) => candidate.key === 'target-manager')
    if (!participant || participant.selector.type !== 'MANAGEMENT_ROLE_ON_SELECTED_DEPARTMENT') throw new Error('Fixture participant not found')
    participant.selector.departmentFieldKey = 'missing-department'
    compileFailure(definition, 'SELECTOR_FIELD_UNKNOWN', ['participants'])
  })

  it('rejects missing translations for an enabled language', () => {
    const definition = copyFixture()
    const field = fieldByKey(definition, 'reason')
    field.label = { nl: 'Reden' }
    compileFailure(definition, 'MISSING_TRANSLATION', ['forms'])
  })

  it('rejects an incomplete field access matrix', () => {
    const definition = copyFixture()
    const field = fieldByKey(definition, 'reason')
    field.access = field.access.filter((rule) => rule.participantKey !== 'hr-queue')
    compileFailure(definition, 'FIELD_ACCESS_MATRIX_INCOMPLETE', ['forms'])
  })

  it('rejects a condition with incompatible types', () => {
    const definition = copyFixture()
    const field = fieldByKey(definition, 'reason')
    field.visibilityCondition = {
      operator: 'equals',
      left: { kind: 'FIELD', fieldKey: 'current-department' },
      right: { kind: 'LITERAL', value: true },
    }
    compileFailure(definition, 'CONDITION_TYPE_MISMATCH', ['forms'])
  })

  it('round-trips visibility and required conditions through the versioned draft contract', () => {
    const definition = copyFixture()
    const field = fieldByKey(definition, 'reason')
    const condition = { operator: 'isNotEmpty' as const, operand: { kind: 'FIELD' as const, fieldKey: 'effective-on' } }
    field.visibilityCondition = condition
    field.requiredCondition = condition
    const reopened = JSON.parse(JSON.stringify(definition)) as ProcessDefinitionDraft

    const compiled = compileProcessDefinition(reopened)
    const compiledField = compiled.content.forms[0]?.sections[0]?.fields.find((candidate) => candidate.key === 'reason')
    expect(compiledField?.visibilityCondition).toEqual(condition)
    expect(compiledField?.requiredCondition).toEqual(condition)
    expect(compiled.hash).toBe(compileProcessDefinition(reopened).hash)
  })

  it('rejects a required condition that refers to a deleted field', () => {
    const definition = copyFixture()
    fieldByKey(definition, 'reason').requiredCondition = {
      operator: 'isNotEmpty',
      operand: { kind: 'FIELD', fieldKey: 'removed-field' },
    }
    compileFailure(definition, 'CONDITION_REFERENCE_UNKNOWN', ['forms'])
  })

  it('rejects a conditional required field that is also unconditionally required by its access rule', () => {
    const definition = copyFixture()
    const field = fieldByKey(definition, 'reason')
    field.requiredCondition = {
      operator: 'isNotEmpty',
      operand: { kind: 'FIELD', fieldKey: 'current-department' },
    }
    field.access = field.access.map((rule) => rule.participantKey === 'initiator' ? { ...rule, mode: 'WRITE_REQUIRED' as const } : rule)
    compileFailure(definition, 'FIELD_REQUIRED_CONDITION_ACCESS_CONFLICT', ['forms'])
  })

  it('rejects field conditions that depend on a conditionally hidden source field', () => {
    const definition = copyFixture()
    const source = fieldByKey(definition, 'current-department')
    source.visibilityCondition = {
      operator: 'isNotEmpty',
      operand: { kind: 'FIELD', fieldKey: 'effective-on' },
    }
    fieldByKey(definition, 'reason').requiredCondition = {
      operator: 'isNotEmpty',
      operand: { kind: 'FIELD', fieldKey: 'current-department' },
    }
    compileFailure(definition, 'CONDITION_REFERENCES_HIDDEN_FIELD', ['forms'])
  })

  it('detects dependency cycles that include a required condition', () => {
    const definition = copyFixture()
    fieldByKey(definition, 'reason').requiredCondition = {
      operator: 'isNotEmpty',
      operand: { kind: 'FIELD', fieldKey: 'current-department' },
    }
    fieldByKey(definition, 'current-department').requiredCondition = {
      operator: 'isNotEmpty',
      operand: { kind: 'FIELD', fieldKey: 'reason' },
    }
    compileFailure(definition, 'CONDITION_CIRCULAR_DEPENDENCY', ['forms'])
  })

  it('rejects a condition that exposes a hidden dependency', () => {
    const definition = copyFixture()
    const target = fieldByKey(definition, 'reason')
    const source = fieldByKey(definition, 'current-department')
    source.access = source.access.map((rule) => rule.participantKey === 'initiator' ? { ...rule, mode: 'HIDDEN' as const } : rule)
    target.visibilityCondition = {
      operator: 'isNotEmpty',
      operand: { kind: 'FIELD', fieldKey: 'current-department' },
    }
    compileFailure(definition, 'CONDITION_REFERENCES_HIDDEN_FIELD', ['forms'])
  })

  it('rejects a document output without a dossier category', () => {
    const definition = copyFixture()
    if (!definition.output) throw new Error('Fixture output not found')
    definition.output.format = 'PDF'
    definition.output.dossierCategoryKey = undefined
    compileFailure(definition, 'OUTPUT_DOCUMENT_CATEGORY_REQUIRED', ['output'])
  })

  it('rejects an access escalation compared with the previous compiled version', () => {
    const previous = compileProcessDefinition(internalTransferFixture)
    const definition = copyFixture()
    const field = fieldByKey(definition, 'target-department')
    field.access = field.access.map((rule) => rule.participantKey === 'source-manager' ? { ...rule, mode: 'WRITE_REQUIRED' as const } : rule)
    compileFailureWithOptions(definition, previous)
  })
})

function compileFailureWithOptions(definition: ProcessDefinitionDraft, previous: ReturnType<typeof compileProcessDefinition>): void {
  let caught: unknown
  try {
    compileProcessDefinition(definition, { previousCompiledDefinition: previous })
  } catch (error) {
    caught = error
  }
  expect(caught).toBeInstanceOf(DefinitionCompilerError)
  expect((caught as DefinitionCompilerError).issues.some((issue) => issue.code === 'SECURITY_ACCESS_ESCALATION' && issue.path.includes('source-manager'))).toBe(true)
}
