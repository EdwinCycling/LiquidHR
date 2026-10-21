import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./studio-workspace.tsx', import.meta.url), 'utf8')

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

  it('keeps publish and retire dialogs non-closable while their API action is pending', () => {
    expect(source.match(/closeLabel=\{(?:publishPending|retirePending) \? undefined : labels\.cancel\}/g)).toHaveLength(2)
    expect(source.match(/closeOnBackdropClick=\{!(?:publishPending|retirePending)\}/g)).toHaveLength(2)
    expect(source.match(/closeOnEscape=\{!(?:publishPending|retirePending)\}/g)).toHaveLength(2)
    expect(source).toContain("if (!publishPending) setShowPublish(open)")
    expect(source).toContain("if (!retirePending) setShowRetire(open)")
  })
})
