import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FieldAccessMatrix } from './field-access-matrix'
import type { FieldDefinition, ParticipantDefinition, ProcessStep } from '@/lib/process-automation/definition-schemas'

const field: FieldDefinition = {
  key: 'manager-advice',
  label: { nl: 'Advies manager', en: 'Manager advice' },
  type: 'SHORT_TEXT',
  binding: { kind: 'PROCESS_ONLY' },
  access: [{ participantKey: 'manager', mode: 'WRITE_OPTIONAL' }],
}
const participant: ParticipantDefinition = {
  key: 'manager',
  label: { nl: 'Manager', en: 'Manager' },
  selector: { type: 'DIRECT_MANAGER_OF_SUBJECT', resolutionDatePolicy: 'STEP_ACTIVATED_AT' },
  assignmentMode: 'EXACTLY_ONE',
  permission: 'process-task:act',
}
const step: ProcessStep = {
  key: 'manager-review',
  type: 'FORM',
  title: { nl: 'Beoordeling manager', en: 'Manager review' },
  participantKey: 'manager',
  formKey: 'training',
  allowedActions: ['SUBMIT'],
}
const labels = {
  title: 'Rechten per processtap',
  description: 'De rechten blijven begrensd.',
  selectStep: 'Processtap',
  noSteps: 'Geen processtappen',
  field: 'Veld',
  participant: 'Deelnemer',
  hidden: 'Verborgen',
  read: 'Lezen',
  writeOptional: 'Bewerken',
  writeRequired: 'Verplicht',
  conditionalRequiredWarning: 'Kies bewerken bij een voorwaarde.',
  participantLimitWarning: 'Deze keuze gaat verder dan de deelnemersrechten.',
}

describe('field access matrix', () => {
  it('shows a localized field row, assigned participant, and accessible step selector', () => {
    const markup = renderToStaticMarkup(createElement(FieldAccessMatrix, {
      fields: [field],
      steps: [step],
      participants: [participant],
      selectedStepKey: step.key,
      editing: true,
      language: 'nl',
      labels,
      onStepChange: () => undefined,
      onModeChange: () => undefined,
    }))

    expect(markup).toContain('Advies manager')
    expect(markup).toContain('Manager')
    expect(markup).toContain('aria-label="Processtap"')
    expect(markup).toContain('md:block')
    expect(markup).toContain('md:hidden')
    expect(markup).toContain('Verborgen')
    expect(markup).toContain('Verplicht')
  })
})
