import { describe, expect, it } from 'vitest'
import { compileProcessDefinition, DefinitionCompilerError } from './definition-compiler'
import { createEmptyStudioDraft, createTrainingRequestExampleDraft } from './studio-draft-factories'

const identity = {
  key: 'opleiding-aanvragen',
  title: { nl: 'Opleidingsaanvraag', en: 'Training request' },
  description: { nl: 'Aanvraag en beoordeling van een opleiding.', en: 'Request and review training.' },
}

describe('Process studio draft starting points', () => {
  it('creates a genuinely empty draft with the entered name and description', () => {
    const draft = createEmptyStudioDraft(identity)

    expect(draft.title).toEqual(identity.title)
    expect(draft.description).toEqual(identity.description)
    expect(draft.steps).toEqual([])
    expect(draft.participants).toEqual([])
    expect(draft.forms).toEqual([])
    expect(draft.transitions).toEqual([])
    expect(() => compileProcessDefinition(draft)).toThrow(DefinitionCompilerError)
  })

  it('creates a typed training-request example with a request-changes return route and no domain bindings', () => {
    const draft = createTrainingRequestExampleDraft(identity)
    const compiled = compileProcessDefinition(draft)

    expect(draft.steps.map((step) => step.title.nl)).toEqual([
      'Opleiding aanvragen',
      'Manager beoordeelt',
      'HR verwerkt de aanvraag',
      'Afgerond',
      'Afgewezen',
    ])
    expect(draft.transitions.find((transition) => transition.action === 'REQUEST_CHANGES')).toMatchObject({
      fromStepKey: 'manager-review',
      toStepKey: 'employee-request',
      kind: 'RECOVERY',
    })
    expect(draft.forms.flatMap((form) => form.sections.flatMap((section) => section.fields)).every((field) => field.binding.kind === 'PROCESS_ONLY')).toBe(true)
    expect(compiled.content.status).toBe('PUBLISHED')
  })
})
