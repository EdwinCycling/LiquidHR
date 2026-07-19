export type ToggleableModuleCode = 'HERA' | 'DOCUMENTS' | 'REMINDERS'
export type FutureModuleCode = 'LEAVE' | 'ABSENCE' | 'ASSETS' | 'WORKFLOWS' | 'TRAINING'

export type ModuleDefinition = {
  code: ToggleableModuleCode | FutureModuleCode
  status: 'AVAILABLE' | 'COMING_SOON'
  toggleable: boolean
}

const MODULE_CATALOG: readonly ModuleDefinition[] = [
  { code: 'HERA', status: 'AVAILABLE', toggleable: true },
  { code: 'DOCUMENTS', status: 'AVAILABLE', toggleable: true },
  { code: 'REMINDERS', status: 'AVAILABLE', toggleable: true },
  { code: 'LEAVE', status: 'COMING_SOON', toggleable: false },
  { code: 'ABSENCE', status: 'COMING_SOON', toggleable: false },
  { code: 'ASSETS', status: 'COMING_SOON', toggleable: false },
  { code: 'WORKFLOWS', status: 'COMING_SOON', toggleable: false },
  { code: 'TRAINING', status: 'COMING_SOON', toggleable: false },
]

const TOGGLEABLE_MODULES = new Set<ToggleableModuleCode>(['HERA', 'DOCUMENTS', 'REMINDERS'])

export function getModuleCatalog(): readonly ModuleDefinition[] {
  return MODULE_CATALOG
}

export function isToggleableModuleCode(value: string): value is ToggleableModuleCode {
  return TOGGLEABLE_MODULES.has(value as ToggleableModuleCode)
}

export function normalizeModuleSelection(values: readonly string[]): ToggleableModuleCode[] {
  return [...new Set(values.filter(isToggleableModuleCode))]
}
