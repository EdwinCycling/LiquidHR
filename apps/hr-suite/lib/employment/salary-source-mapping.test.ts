import { describe, expect, it } from 'vitest'
import { mapCaoSalarySource } from './salary-source-mapping'

describe('mapCaoSalarySource', () => {
  it('preserves the scale code and step code for the CAO engine', () => {
    expect(mapCaoSalarySource({
      salaryRoute: 'SCALE_WITH_STEPS',
      selectedScale: { code: 'I', name: 'Functiegroep I' },
      selectedStep: { stepCode: '15', label: 'Trede 15' },
    })).toEqual({ caoScaleName: 'I · Functiegroep I', caoStepName: '15 · Trede 15' })
  })

  it('supports numeric Kinderopvang scales without changing the source shape', () => {
    expect(mapCaoSalarySource({
      salaryRoute: 'SCALE_WITH_STEPS',
      selectedScale: { code: '6', name: 'Schaal 6' },
      selectedStep: { stepCode: '12', label: 'Salarisnummer 12' },
    })).toEqual({ caoScaleName: '6 · Schaal 6', caoStepName: '12 · Salarisnummer 12' })
  })

  it('does not attach CAO fields to manual or band salaries', () => {
    expect(mapCaoSalarySource({ salaryRoute: 'MANUAL', selectedScale: undefined, selectedStep: undefined })).toEqual({ caoScaleName: null, caoStepName: null })
  })
})
