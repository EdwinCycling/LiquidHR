export type SalarySourceScale = {
  readonly code: string
  readonly name: string
}

export type SalarySourceStep = {
  readonly stepCode: string
  readonly label: string
}

export function mapCaoSalarySource(input: {
  readonly salaryRoute: string
  readonly selectedScale: SalarySourceScale | undefined
  readonly selectedStep: SalarySourceStep | undefined
}): { readonly caoScaleName: string | null; readonly caoStepName: string | null } {
  if (input.salaryRoute !== 'SCALE_WITH_STEPS') return { caoScaleName: null, caoStepName: null }
  return {
    caoScaleName: input.selectedScale ? `${input.selectedScale.code} · ${input.selectedScale.name}` : null,
    caoStepName: input.selectedStep ? `${input.selectedStep.stepCode} · ${input.selectedStep.label}` : null,
  }
}
