import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { evaluateFormPreview, FormStudioPreview, updateFormPreviewValues } from './form-studio-preview'
import { createTrainingRequestExampleDraft } from '@/lib/process-automation/studio-draft-factories'
import type { FormDefinition, FieldDefinition } from '@/lib/process-automation/definition-schemas'
import type { FormPreviewLabels } from './form-studio-preview'

const condition = {
  operator: 'greaterThan' as const,
  left: { kind: 'FIELD' as const, fieldKey: 'training-expected-cost' },
  right: { kind: 'LITERAL' as const, value: 1000 },
}

const example = createTrainingRequestExampleDraft({ key: 'training-request', title: { nl: 'Opleidingsaanvraag', en: 'Training request' }, description: { nl: 'Aanvraag en beoordeling.', en: 'Request and review.' } })
const baseForm = example.forms[0]
if (!baseForm) throw new Error('Opleidingsaanvraag form not found')
const highCostExplanation: FieldDefinition = {
  key: 'high-cost-explanation', label: { nl: 'Toelichting hoge kosten', en: 'High cost explanation' }, type: 'LONG_TEXT', binding: { kind: 'PROCESS_ONLY' },
  access: [
    { participantKey: 'employee', mode: 'WRITE_OPTIONAL' },
    { participantKey: 'manager', mode: 'READ' },
    { participantKey: 'hr-team', mode: 'READ' },
  ], visibilityCondition: condition, requiredCondition: condition,
}
const form: FormDefinition = {
  ...baseForm,
  sections: baseForm.sections.map((section) => ({ ...section, fields: [...section.fields, highCostExplanation] })),
}
const stepForm: FormDefinition = {
  ...form,
  sections: form.sections.map((section) => ({
    ...section,
    fields: section.fields.map((field) => field.key === highCostExplanation.key ? {
      ...field,
      stepAccess: [
        { stepKey: 'employee-request', participantKey: 'employee', mode: 'WRITE_OPTIONAL' },
        { stepKey: 'manager-review', participantKey: 'manager', mode: 'READ' },
        { stepKey: 'hr-decision', participantKey: 'hr-team', mode: 'READ' },
      ],
    } : field),
  })),
}

const labels: FormPreviewLabels = {
  syntheticData: 'Example values are not saved.', noValue: 'No value',
  previewHidden: '{field} is hidden based on the example values.', previewRequired: 'Required',
  fieldTypeLabels: { MONEY: 'Amount', LONG_TEXT: 'Long text' },
}

describe('Formulierenstudio conditional preview', () => {
  it('re-evaluates visibility and requiredness for below, equal, above, empty and invalid values', () => {
    const state = (value: string | number | null | undefined) => evaluateFormPreview(form, 'employee', { 'training-expected-cost': value ?? null })
    const visibleAndRequired = (value: string | number | null | undefined) => {
      const explanation = state(value).find((item) => item.field.key === 'high-cost-explanation')
      return { visible: explanation?.visible, required: explanation?.required }
    }

    expect(visibleAndRequired(750)).toEqual({ visible: false, required: false })
    expect(visibleAndRequired(1000)).toEqual({ visible: false, required: false })
    expect(visibleAndRequired(1250)).toEqual({ visible: true, required: true })
    expect(visibleAndRequired(null)).toEqual({ visible: false, required: false })
    expect(visibleAndRequired('not a cost')).toEqual({ visible: false, required: false })

    const managerExplanation = evaluateFormPreview(form, 'manager', { 'training-expected-cost': 1250 })
      .find((item) => item.field.key === 'high-cost-explanation')
    expect(managerExplanation).toMatchObject({ accessMode: 'READ', visible: true, required: false })
  })

  it('clears the synthetic answer as soon as the source value hides the conditional field', () => {
    const visibleValues = updateFormPreviewValues(form, 'employee', {}, 'training-expected-cost', 1250)
    const withExplanation = updateFormPreviewValues(form, 'employee', visibleValues, 'high-cost-explanation', 'Review requested')
    expect(withExplanation['high-cost-explanation']).toBe('Review requested')

    const hiddenValues = updateFormPreviewValues(form, 'employee', withExplanation, 'training-expected-cost', 750)
    expect(hiddenValues['high-cost-explanation']).toBeUndefined()
    const shownAgain = updateFormPreviewValues(form, 'employee', hiddenValues, 'training-expected-cost', 1250)
    expect(shownAgain['high-cost-explanation']).toBeUndefined()
  })

  it('previews field access for the selected step and participant', () => {
    const employeeField = evaluateFormPreview(stepForm, 'employee', { 'training-expected-cost': 1250 }, 'employee-request')
      .find((item) => item.field.key === highCostExplanation.key)
    const managerField = evaluateFormPreview(stepForm, 'manager', { 'training-expected-cost': 1250 }, 'manager-review')
      .find((item) => item.field.key === highCostExplanation.key)
    const forgedStepField = evaluateFormPreview(stepForm, 'employee', { 'training-expected-cost': 1250 }, 'manager-review')
      .find((item) => item.field.key === highCostExplanation.key)

    expect(employeeField).toMatchObject({ accessMode: 'WRITE_OPTIONAL', visible: true, required: true })
    expect(managerField).toMatchObject({ accessMode: 'READ', visible: true, required: false })
    expect(forgedStepField).toMatchObject({ accessMode: 'HIDDEN', visible: false, required: false })
  })
  it('shows a sample-value preview and explains conditionally hidden fields', () => {
    const markup = renderToStaticMarkup(createElement(FormStudioPreview, {
      form,
      labels,
      language: 'en',
      participantKey: 'employee',
    }))

    expect(markup).toContain('Example values are not saved.')
    expect(markup).toContain('Which training would you like to take?')
    expect(markup).toContain('What is the expected cost?')
    expect(markup).toContain('High cost explanation is hidden based on the example values.')
    expect(markup.replace(/<[^>]+>/g, ' ')).not.toContain('expected-costs')
  })
})
