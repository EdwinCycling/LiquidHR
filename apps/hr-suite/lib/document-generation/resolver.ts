import type { NormalizedDocumentV1 } from '@/lib/document-studio/normalized-document'

export type GenerationInputValues = Readonly<Record<string, string>>

export interface RequiredGenerationValues {
  readonly known: Readonly<Record<string, string>>
  readonly temporal: Readonly<Record<string, string>>
  readonly free: Readonly<Record<string, string>>
  readonly temporalKeys: readonly string[]
  readonly freeKeys: readonly string[]
}

export class GenerationResolutionError extends Error {
  constructor(readonly missingKeys: readonly string[]) {
    super('DOCUMENT_GENERATION_FIELD_UNRESOLVED')
    this.name = 'GenerationResolutionError'
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

function requiredKeys(
  manifest: NormalizedDocumentV1['placeholderManifest'],
  type: 'KNOWN' | 'TEMPORAL' | 'FREE',
): string[] {
  return unique(manifest.filter((entry) => entry.type === type).map((entry) => entry.key))
}

function onlyRequired(keys: readonly string[], values: GenerationInputValues): Record<string, string> {
  return Object.fromEntries(keys.map((key) => [key, values[key] ?? '']))
}

export function resolveRequiredGenerationValues(
  manifest: NormalizedDocumentV1['placeholderManifest'],
  knownCatalog: GenerationInputValues,
  temporalInputs: GenerationInputValues,
  freeInputs: GenerationInputValues,
): RequiredGenerationValues {
  const knownKeys = requiredKeys(manifest, 'KNOWN')
  const temporalKeys = requiredKeys(manifest, 'TEMPORAL')
  const freeKeys = requiredKeys(manifest, 'FREE')
  const known = onlyRequired(knownKeys, knownCatalog)
  const temporal = onlyRequired(temporalKeys, temporalInputs)
  const free = onlyRequired(freeKeys, freeInputs)
  const missingKeys = [
    ...knownKeys.filter((key) => !known[key]?.trim()),
    ...temporalKeys.filter((key) => !temporal[key]?.trim()),
    ...freeKeys.filter((key) => !free[key]?.trim()),
  ]
  if (missingKeys.length > 0) throw new GenerationResolutionError(missingKeys)
  return { known, temporal, free, temporalKeys, freeKeys }
}
