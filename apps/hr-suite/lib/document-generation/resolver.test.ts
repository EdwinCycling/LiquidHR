import { describe, expect, it } from 'vitest'
import type { NormalizedDocumentV1 } from '@/lib/document-studio/normalized-document'
import { GenerationResolutionError, resolveRequiredGenerationValues } from './resolver'

const manifest: NormalizedDocumentV1['placeholderManifest'] = [
  { type: 'KNOWN', key: 'employee.first_name', locations: ['/regions/body/content/0'] },
  { type: 'TEMPORAL', key: 'employment.start_date[was]', locations: ['/regions/body/content/1'] },
  { type: 'TEMPORAL', key: 'employment.start_date[is]', locations: ['/regions/body/content/2'] },
  { type: 'TEMPORAL', key: 'employment.start_date[wordt]', locations: ['/regions/body/content/3'] },
  { type: 'FREE', key: 'LetterSubject', locations: ['/regions/body/content/4'] },
]

describe('DG1 semantic resolver', () => {
  it('resolves manifest-driven known, temporal, and free values and ignores unknown input', () => {
    const result = resolveRequiredGenerationValues(
      manifest,
      { 'employee.first_name': 'Sanne', 'employee.last_name': 'De Vries', ignored: 'drop' },
      {
        'employment.start_date[was]': '2020-01-01',
        'employment.start_date[is]': '2024-01-01',
        'employment.start_date[wordt]': '2026-09-04',
        'ignored[field]': 'drop',
      },
      { LetterSubject: 'Arbeidsovereenkomst', Other: 'drop' },
    )

    expect(result.known).toEqual({ 'employee.first_name': 'Sanne' })
    expect(result.temporal).toEqual({
      'employment.start_date[was]': '2020-01-01',
      'employment.start_date[is]': '2024-01-01',
      'employment.start_date[wordt]': '2026-09-04',
    })
    expect(result.free).toEqual({ LetterSubject: 'Arbeidsovereenkomst' })
  })

  it('rejects every required value that is missing instead of rendering an empty placeholder', () => {
    expect(() => resolveRequiredGenerationValues(manifest, {}, {}, {})).toThrowError(GenerationResolutionError)
    try {
      resolveRequiredGenerationValues(manifest, {}, {}, {})
    } catch (error) {
      expect(error).toMatchObject({ missingKeys: [
        'employee.first_name',
        'employment.start_date[was]',
        'employment.start_date[is]',
        'employment.start_date[wordt]',
        'LetterSubject',
      ] })
    }
  })
})
