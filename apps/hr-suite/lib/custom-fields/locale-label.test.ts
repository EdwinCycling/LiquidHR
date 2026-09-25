import { describe, expect, it } from 'vitest'
import { localizedCustomFieldLabel } from './locale-label'

describe('localizedCustomFieldLabel', () => {
  it('uses the matching custom field label for English and Dutch', () => {
    expect(localizedCustomFieldLabel('Beoordelingsdatum', 'Review date', 'en')).toBe('Review date')
    expect(localizedCustomFieldLabel('Beoordelingsdatum', 'Review date', 'nl')).toBe('Beoordelingsdatum')
  })
})
