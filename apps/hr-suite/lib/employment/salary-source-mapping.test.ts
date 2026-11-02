import { describe, expect, it } from 'vitest'
import { mapCaoSalarySource, resolveSalaryApplicationBasis } from './salary-source-mapping'

describe('mapCaoSalarySource', () => {
  it('preserves the scale code and step code for the CAO engine', () => {
    expect(mapCaoSalarySource({
      salaryRoute: 'SCALE_WITH_STEPS',
      salaryBasis: 'CAO_SCALE',
      selectedScale: { code: 'I', name: 'Functiegroep I' },
      selectedStep: { stepCode: '15', label: 'Trede 15' },
    })).toEqual({ caoScaleName: 'I · Functiegroep I', caoStepName: '15 · Trede 15' })
  })

  it('supports numeric Kinderopvang scales without changing the source shape', () => {
    expect(mapCaoSalarySource({
      salaryRoute: 'SCALE_WITH_STEPS',
      salaryBasis: 'CAO_SCALE',
      selectedScale: { code: '6', name: 'Schaal 6' },
      selectedStep: { stepCode: '12', label: 'Salarisnummer 12' },
    })).toEqual({ caoScaleName: '6 · Schaal 6', caoStepName: '12 · Salarisnummer 12' })
  })

  it('does not attach CAO fields to manual or band salaries', () => {
    expect(mapCaoSalarySource({ salaryRoute: 'MANUAL', salaryBasis: 'MANUAL', selectedScale: undefined, selectedStep: undefined })).toEqual({ caoScaleName: null, caoStepName: null })
    expect(mapCaoSalarySource({
      salaryRoute: 'SCALE_WITH_STEPS',
      salaryBasis: 'CUSTOM_SCALE',
      selectedScale: { code: '6', name: 'Schaal 6' },
      selectedStep: { stepCode: '12', label: 'Salarisnummer 12' },
    })).toEqual({ caoScaleName: null, caoStepName: null })
  })

  it('preserves an explicitly selected CAO basis while resolving the salary route', () => {
    expect(resolveSalaryApplicationBasis('SCALE_WITH_STEPS', 'CAO_SCALE')).toBe('CAO_SCALE')
    expect(resolveSalaryApplicationBasis('SCALE_WITH_STEPS', 'CUSTOM_SCALE')).toBe('CUSTOM_SCALE')
    expect(resolveSalaryApplicationBasis('MINIMUM_WAGE', 'CAO_SCALE')).toBe('MINIMUM_WAGE')
  })
})
