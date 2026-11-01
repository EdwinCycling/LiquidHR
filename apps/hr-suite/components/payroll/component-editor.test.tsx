// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentEditorState } from '@/lib/payroll/component-editor-state'
import { newComponentEditorState } from '@/lib/payroll/component-editor-state'
import { ComponentEditor } from './component-editor'

const payrollActions = vi.hoisted(() => ({
  previewComponentDraftAction: vi.fn(),
  saveComponentDraftAction: vi.fn(),
  validateComponentDraftAction: vi.fn(),
}))

vi.mock('@/app/(dashboard)/payroll-components/actions', () => payrollActions)
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const labels: Readonly<Record<string, string>> = {
  payrollComponentsEditorFormulaGuide: 'Formulehulp',
  payrollComponentsEditorFormulaGuideIntro: 'Klik een referentie om die op de cursorpositie in te voegen.',
  payrollComponentsEditorFormulaTypes: 'Waardetypen',
  payrollComponentsEditorFormulaOperators: 'Operatoren',
  payrollComponentsEditorFormulaFunctions: 'Functies',
  payrollComponentsEditorFormulaReferences: 'Referenties',
  payrollComponentsEditorFormulaInputReference: 'Invoerwaarde.',
  payrollComponentsEditorFormulaParameterReference: 'Componentparameter.',
  payrollComponentsEditorFormulaDependencyReference: 'Componentuitvoer.',
  payrollComponentsEditorFormulaDependencyRequired: 'Voeg de component toe bij Afhankelijkheden.',
  payrollComponentsEditorFormulaAvailableReferences: 'Beschikbare referenties',
  payrollComponentsEditorFormulaInsertReference: 'Invoegen',
  payrollComponentsEditorFormulaNoDependencies: 'Voeg eerst een afhankelijkheid toe.',
  payrollComponentsEditorFormulaReferenceTooLong: 'De formule mag maximaal 1.200 tekens bevatten.',
  payrollComponentsEditorFormulaExamples: 'Voorbeelden',
  payrollComponentsEditorFormulaExamplesNote: 'Waardetype van de uitvoer moet passen.',
  payrollComponentsEditorFormulaExampleMoney: 'MONEY(1250.00)',
  payrollComponentsEditorFormulaExampleIf: 'IF(TRUE, MONEY(1250.00), MONEY(0.00))',
  payrollComponentsEditorFormulaExampleMax: 'MAX(DECIMAL(1.00), DECIMAL(2.00))',
  payrollComponentsEditorFormulaHelp: 'Valideer server-side.',
  payrollComponentsEditorInputName: 'Invoer',
  payrollComponentsEditorParameterName: 'Parameter',
  payrollComponentsEditorDependencies: 'Afhankelijkheden',
  payrollComponentsEditorNoInputs: 'Geen invoer',
  payrollComponentsEditorNoParameters: 'Geen parameters',
  payrollComponentsEditorValidate: 'Valideren',
  payrollComponentsEditorRunPreview: 'Proefberekenen',
  payrollComponentsEditorResult: 'Resultaat',
  payrollComponentsEditorTrace: 'Trace',
  payrollComponentsEditorIssueFormula: 'De formulesyntax is ongeldig.',
}

const initial: ComponentEditorState = {
  ...newComponentEditorState('NL-2026', '2026-01-01', 'Voorbeeldcomponent', 'other'),
  inputs: [{ name: 'baseGross', valueType: 'MONEY', required: true }],
  outputs: [{ name: 'amount', valueType: 'MONEY' }],
  dependencies: [{ componentCode: 'NL_GROSS', outputName: 'Amount', inputName: 'baseGross' }],
  parameters: [{ name: 'rate', valueType: 'PERCENTAGE', value: '0.10' }],
  method: { kind: 'expression', formulas: { amount: 'MONEY(100.00)' } },
  previewInputs: { baseGross: '1000.00' },
}

function mountEditor(editorInitial: ComponentEditorState = initial) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  act(() => root.render(<ComponentEditor
    canSave
    dependencyOptions={[
      { componentCode: 'NL_GROSS', outputName: 'Amount', valueType: 'MONEY', label: 'Bruto loon' },
      { componentCode: 'UNDECLARED', outputName: 'Amount', valueType: 'MONEY', label: 'Niet toegevoegd' },
    ]}
    initial={editorInitial}
    labels={labels}
    ownershipLabel="CUSTOMER_CUSTOM"
    packageOptions={[]}
    provenanceLabel=""
  />))
  return {
    host,
    unmount: () => {
      act(() => root.unmount())
      host.remove()
    },
  }
}

function selectFormulaRange(textarea: HTMLTextAreaElement, start: number, end: number): void {
  act(() => {
    textarea.focus()
    textarea.setSelectionRange(start, end)
    textarea.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

async function clickReference(host: HTMLElement, reference: string): Promise<void> {
  const button = Array.from(host.querySelectorAll('button')).find((candidate) => candidate.textContent?.trim() === reference)
  if (!button) throw new Error(`Missing formula reference button: ${reference}`)
  await act(async () => {
    button.click()
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
  })
}

describe('Payroll component formula help', () => {
  afterEach(() => {
    payrollActions.previewComponentDraftAction.mockReset()
    payrollActions.saveComponentDraftAction.mockReset()
    payrollActions.validateComponentDraftAction.mockReset()
  })

  it('inserts only available references at the selected range and surfaces the existing server validation error', async () => {
    payrollActions.validateComponentDraftAction.mockResolvedValue({ valid: false, issues: ['FORMULA_INVALID'] })
    const mounted = mountEditor()
    try {
      const details = mounted.host.querySelector('details')
      const textarea = Array.from(mounted.host.querySelectorAll('textarea')).find((candidate) => candidate.maxLength === 1200)
      expect(details?.open).toBe(false)
      expect(textarea).not.toBeNull()
      expect(mounted.host.textContent).toContain('COMPONENT.output')
      expect(mounted.host.textContent).toContain('MONEY(1250.00)')

      act(() => details?.querySelector('summary')?.click())
      expect(details?.open).toBe(true)

      const formula = textarea as HTMLTextAreaElement
      selectFormulaRange(formula, 0, formula.value.length)
      await clickReference(mounted.host, 'input.baseGross')
      expect(formula.value).toBe('input.baseGross')
      expect(document.activeElement).toBe(formula)
      expect(formula.selectionStart).toBe('input.baseGross'.length)

      selectFormulaRange(formula, 0, formula.value.length)
      await clickReference(mounted.host, 'parameter.rate')
      expect(formula.value).toBe('parameter.rate')

      expect(mounted.host.textContent).toContain('NL_GROSS.Amount')
      expect(mounted.host.textContent).not.toContain('UNDECLARED.Amount')
      selectFormulaRange(formula, 0, formula.value.length)
      await clickReference(mounted.host, 'NL_GROSS.Amount')
      expect(formula.value).toBe('NL_GROSS.Amount')

      const validate = Array.from(mounted.host.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Valideren')
      expect(validate).toBeDefined()
      await act(async () => {
        validate?.click()
        await Promise.resolve()
      })

      expect(payrollActions.validateComponentDraftAction).toHaveBeenCalledWith(expect.objectContaining({
        method: { kind: 'expression', formulas: { amount: 'NL_GROSS.Amount' } },
      }))
      expect(mounted.host.querySelector('[role="alert"]')?.textContent).toContain('De formulesyntax is ongeldig.')
    } finally {
      mounted.unmount()
    }
  })

  it('keeps reference insertion within the existing 1,200-character formula limit', async () => {
    const tooLong: ComponentEditorState = {
      ...initial,
      method: { kind: 'expression', formulas: { amount: 'x'.repeat(1195) } },
    }
    const mounted = mountEditor(tooLong)
    try {
      const details = mounted.host.querySelector('details')
      const textarea = Array.from(mounted.host.querySelectorAll('textarea')).find((candidate) => candidate.maxLength === 1200)
      expect(textarea).not.toBeNull()
      act(() => details?.querySelector('summary')?.click())
      const formula = textarea as HTMLTextAreaElement
      selectFormulaRange(formula, formula.value.length, formula.value.length)
      await clickReference(mounted.host, 'input.baseGross')

      expect(formula.value).toHaveLength(1195)
      expect(mounted.host.querySelector('[role="alert"]')?.textContent).toContain('De formule mag maximaal 1.200 tekens bevatten.')
    } finally {
      mounted.unmount()
    }
  })

  it('uses the existing preview action and renders the returned result and trace', async () => {
    payrollActions.previewComponentDraftAction.mockResolvedValue({
      valid: true,
      issues: [],
      result: {
        status: 'SUCCEEDED',
        method: 'expression',
        formulas: [{ outputName: 'amount', formula: 'MONEY(100.00)' }],
        parameters: [],
        outputs: [{ name: 'amount', valueType: 'MONEY', value: '100.00' }],
        trace: [{
          sequence: 1,
          componentCode: 'CUSTOM_COMPONENT',
          version: '1',
          inputs: {},
          outputs: { amount: { valueType: 'MONEY', value: '100.00' } },
          dependencyRefs: [],
        }],
        rounding: [],
        controls: [],
      },
    })
    const mounted = mountEditor()
    try {
      const preview = Array.from(mounted.host.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Proefberekenen')
      expect(preview).toBeDefined()
      await act(async () => {
        preview?.click()
        await Promise.resolve()
      })

      expect(payrollActions.previewComponentDraftAction).toHaveBeenCalledWith(expect.objectContaining({
        method: { kind: 'expression', formulas: { amount: 'MONEY(100.00)' } },
      }))
      expect(mounted.host.querySelector('[aria-live="polite"]')?.textContent).toContain('100.00')
      expect(mounted.host.querySelector('[aria-live="polite"]')?.textContent).toContain('Trace')
    } finally {
      mounted.unmount()
    }
  })
})
