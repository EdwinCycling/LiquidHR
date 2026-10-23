import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./studio-workspace.tsx', import.meta.url), 'utf8')
const tokens = readFileSync(new URL('../../app/styles/tokens.css', import.meta.url), 'utf8')
const themes = readFileSync(new URL('../../app/styles/themes.css', import.meta.url), 'utf8')
const foundationSurfaceFiles = [
  source,
  readFileSync(new URL('./certified-recipe-panel.tsx', import.meta.url), 'utf8'),
  readFileSync(new URL('./document-acknowledgement-start-form.tsx', import.meta.url), 'utf8'),
  readFileSync(new URL('./internal-transfer-start-form.tsx', import.meta.url), 'utf8'),
]

describe('process automation pending action dialogs', () => {
  it('exposes the form builder actions and connects them to the existing draft revision flow', () => {
    expect(source).toContain('onClick={addForm}')
    expect(source).toContain('onClick={addSection}')
    expect(source).toContain("updateFormTitle(selectedForm.key, 'nl', event.target.value)")
    expect(source).toContain('onClick={() => duplicateField(section.key, field)}')
    expect(source).toContain('onClick={() => setFieldToRemove({ sectionKey: section.key, fieldKey: field.key, label: titleFor(field.label) })}')
    expect(source).toContain('onChange={(event) => updateStepForm(step.key, event.target.value)}')
    expect(source).toContain('setPreviewStepKey(event.target.value)')
    expect(source).toContain('expectedRevision: draftRevision')
    expect(source).toContain('labels.formEditor.fieldRules')
    expect(source).toContain('max-w-[390px]')
  })

  it('keeps raw field and binding keys out of the form editor', () => {
    expect(source).not.toContain('bindingTechnicalValue')
    expect(source).toContain('labels.bindingEntryLabels[entry.id] ?? labels.bindingUnknown : labels.bindingUnknown')
  })

  it('uses native list and button semantics for the catalog', () => {
    expect(source).toContain('<ul className="mt-4 space-y-2">')
    expect(source).toContain('<li key={item.id}>')
    expect(source).toContain('aria-current={active ? \'true\' : undefined}')
    expect(source).not.toContain('role="listitem"')
  })

  it('shows readable trial labels and gates raw diagnostics behind the authorized advanced view', () => {
    expect(source).toContain('labels.trialSelectorTypeLabels[participant.selectorType] ?? labels.trialSelectorFallback')
    expect(source).toContain('labels.trialStatusLabels[participant.status]')
    expect(source).toContain('trialSlaDuration(step.sla, labels)')
    expect(source).toContain('showDiagnostics={canWrite || canPublish}')
    expect(source).not.toContain('{participant.selectorType} · {participant.permission}')
    expect(source).not.toContain('{participant.participantKey}</span>')
  })

  it('keeps process creation as a full-page three-step wizard with review before creation', () => {
    expect(source).toContain('<h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{labels.newWizardTitle}</h1>')
    expect(source).toContain('{[labels.wizardBasics, labels.wizardStartingPoint, labels.wizardReview].map')
    expect(source).toContain('createStep < 2 ? labels.continue : labels.createDraft')
  })

  it('uses semantic Foundation tokens supported by LiquidHR and LinkedHR themes', () => {
    const defaultThemeMatch = themes.match(/:root,\s*\[data-theme="liquid-navy"\] \{([\s\S]*?)\n\}/)
    const linkedThemeStart = themes.indexOf('[data-theme="linkedhr"] {')
    const linkedThemeEnd = themes.indexOf('\n}', linkedThemeStart)
    const defaultTheme = defaultThemeMatch?.[1] ?? ''
    const linkedTheme = themes.slice(linkedThemeStart, linkedThemeEnd)

    expect(tokens).toContain('--color-success-surface: var(--success-surface)')
    expect(tokens).toContain('--color-warning-surface: var(--warning-surface)')
    expect(tokens).toContain('--color-warning-foreground: var(--warning)')
    for (const token of ['--success:', '--success-surface:', '--warning:', '--warning-surface:', '--destructive:', '--destructive-surface:']) {
      expect(defaultTheme).toContain(token)
      expect(linkedTheme).toContain(token)
    }
    expect(tokens).toContain('--radius-surface: 0.5rem')
    expect(linkedTheme).toContain('--radius-surface:')
    for (const file of foundationSurfaceFiles) {
      expect(file).not.toMatch(/radius-card|bg-amber-|text-amber-|border-amber-|bg-emerald-|text-emerald-|shadow-sm/)
    }
  })

  it('keeps publish and retire dialogs non-closable while their API action is pending', () => {
    expect(source.match(/closeLabel=\{(?:publishPending|retirePending) \? undefined : labels\.cancel\}/g)).toHaveLength(2)
    expect(source.match(/closeOnBackdropClick=\{!(?:publishPending|retirePending)\}/g)).toHaveLength(2)
    expect(source.match(/closeOnEscape=\{!(?:publishPending|retirePending)\}/g)).toHaveLength(2)
    expect(source).toContain("if (!publishPending) setShowPublish(open)")
    expect(source).toContain("if (!retirePending) setShowRetire(open)")
  })
})
