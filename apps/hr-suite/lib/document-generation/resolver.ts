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

function manifestKeys(
  manifest: NormalizedDocumentV1['placeholderManifest'],
  type: 'KNOWN' | 'TEMPORAL' | 'FREE',
): string[] {
  return unique(manifest.filter((entry) => entry.type === type).map((entry) => entry.key))
}

function requiredKeys(
  manifest: NormalizedDocumentV1['placeholderManifest'],
  type: 'KNOWN' | 'TEMPORAL' | 'FREE',
): string[] {
  return unique(manifest.filter((entry) => entry.type === type && entry.optional !== true).map((entry) => entry.key))
}

function onlyManifestValues(keys: readonly string[], values: GenerationInputValues): Record<string, string> {
  return Object.fromEntries(keys.map((key) => [key, values[key] ?? '']))
}

export function resolveRequiredGenerationValues(
  manifest: NormalizedDocumentV1['placeholderManifest'],
  knownCatalog: GenerationInputValues,
  temporalInputs: GenerationInputValues,
  freeInputs: GenerationInputValues,
): RequiredGenerationValues {
  const knownKeys = manifestKeys(manifest, 'KNOWN')
  const temporalKeys = manifestKeys(manifest, 'TEMPORAL')
  const freeKeys = manifestKeys(manifest, 'FREE')
  const requiredKnownKeys = requiredKeys(manifest, 'KNOWN')
  const requiredTemporalKeys = requiredKeys(manifest, 'TEMPORAL')
  const requiredFreeKeys = requiredKeys(manifest, 'FREE')
  const known = onlyManifestValues(knownKeys, knownCatalog)
  const temporal = onlyManifestValues(temporalKeys, temporalInputs)
  const free = onlyManifestValues(freeKeys, freeInputs)
  const missingKeys = [
    ...requiredKnownKeys.filter((key) => !known[key]?.trim()),
    ...requiredTemporalKeys.filter((key) => !temporal[key]?.trim()),
    ...requiredFreeKeys.filter((key) => !free[key]?.trim()),
  ]
  if (missingKeys.length > 0) throw new GenerationResolutionError(missingKeys)
  return { known, temporal, free, temporalKeys, freeKeys }
}
