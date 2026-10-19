export type SalarySourceScale = {
  readonly code: string
  readonly name: string
}

export type SalarySourceStep = {
  readonly stepCode: string
  readonly label: string
}

export type SalaryApplicationBasis = 'MANUAL' | 'MINIMUM_WAGE' | 'CUSTOM_SCALE' | 'CAO_SCALE' | 'SALARY_BAND'

export function resolveSalaryApplicationBasis(
  salaryRoute: string,
  selectedScaleBasis: SalaryApplicationBasis,
): SalaryApplicationBasis {
  if (salaryRoute === 'SCALE_WITH_STEPS') return selectedScaleBasis === 'CAO_SCALE' ? 'CAO_SCALE' : 'CUSTOM_SCALE'
  if (salaryRoute === 'MINIMUM_WAGE') return 'MINIMUM_WAGE'
  if (salaryRoute === 'SALARY_BAND') return 'SALARY_BAND'
  return 'MANUAL'
}

export function mapCaoSalarySource(input: {
  readonly salaryRoute: string
  readonly salaryBasis: SalaryApplicationBasis
  readonly selectedScale: SalarySourceScale | undefined
  readonly selectedStep: SalarySourceStep | undefined
}): { readonly caoScaleName: string | null; readonly caoStepName: string | null } {
  if (input.salaryRoute !== 'SCALE_WITH_STEPS' || input.salaryBasis !== 'CAO_SCALE') {
    return { caoScaleName: null, caoStepName: null }
  }
  return {
    caoScaleName: input.selectedScale ? `${input.selectedScale.code} · ${input.selectedScale.name}` : null,
    caoStepName: input.selectedStep ? `${input.selectedStep.stepCode} · ${input.selectedStep.label}` : null,
  }
}
