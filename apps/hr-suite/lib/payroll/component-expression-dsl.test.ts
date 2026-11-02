import { describe, expect, it } from 'vitest'
import { formatPayrollExpression, parsePayrollExpression } from './component-expression-dsl'
import enNavigation from '../../messages/en/navigation.json'
import nlNavigation from '../../messages/nl/navigation.json'

const formulaExampleKeys = [
  'payrollComponentsEditorFormulaExampleMoney',
  'payrollComponentsEditorFormulaExampleIf',
  'payrollComponentsEditorFormulaExampleMax',
] as const

describe('Payroll component expression text', () => {
  it('round-trips typed formulas, inputs, parameters, dependencies, ratios and conditionals', () => {
    const source = 'IF(input.wage > MONEY(0.00), RATIO(input.wage, parameter.rate, "ratio-policy-v1"), MONEY(0.00))'
    const parsed = parsePayrollExpression(source)

    expect(parsePayrollExpression(formatPayrollExpression(parsed))).toEqual(parsed)
  })

  it.each([
    'globalThis.process.exit()',
    'constructor.constructor("return 1")()',
    'UNKNOWN_FUNCTION(input.value)',
    'input.value; input.value',
    'MONEY(input.value)',
  ])('rejects executable or unsupported formula text: %s', (source) => {
    expect(() => parsePayrollExpression(source)).toThrow('PAYROLL_COMPONENT_FORMULA_INVALID')
  })

  it('accepts the input, parameter and declared component-output reference syntax', () => {
    expect(() => parsePayrollExpression('input.baseGross')).not.toThrow()
    expect(() => parsePayrollExpression('parameter.rate')).not.toThrow()
    expect(() => parsePayrollExpression('NL_GROSS.Amount')).not.toThrow()
  })

  it.each(formulaExampleKeys)('keeps the %s examples in both locales valid in the existing DSL', (key) => {
    const englishExample = enNavigation[key]
    const dutchExample = nlNavigation[key]

    expect(dutchExample).toBe(englishExample)
    expect(() => parsePayrollExpression(englishExample)).not.toThrow()
  })
})
