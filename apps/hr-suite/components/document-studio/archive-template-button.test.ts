import { describe, expect, it } from 'vitest'
import { parseArchiveTemplateResponse } from './archive-template-button'

describe('Document Studio template archive response', () => {
  it('accepts the API data envelope only when archived is true', () => {
    expect(parseArchiveTemplateResponse({ data: { templateId: 'template-1', archived: true } })).toBe(true)
    expect(parseArchiveTemplateResponse({ data: { templateId: 'template-1', archived: false } })).toBe(false)
  })

  it('rejects an unwrapped response', () => {
    expect(parseArchiveTemplateResponse({ templateId: 'template-1', archived: true })).toBe(false)
  })
})
