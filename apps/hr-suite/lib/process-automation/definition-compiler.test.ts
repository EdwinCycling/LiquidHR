import { describe, expect, it } from 'vitest'
import { evaluateCondition } from './condition-evaluator'
import {
  compileProcessDefinition,
  DefinitionCompilerError,
  stableDefinitionHash,
} from './definition-compiler'
import { processDefinitionDraftSchema, type FieldDefinition, type ProcessDefinitionDraft } from './definition-schemas'
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
