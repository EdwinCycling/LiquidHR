import { describe, expect, it } from 'vitest'
import { parseCreatedTemplateResponse } from './template-create-form'

describe('Document Studio template creation response', () => {
  it('reads the API data envelope used by the create route', () => {
    expect(parseCreatedTemplateResponse({ data: { templateId: 'template-1', draftId: 'draft-1' } })).toEqual({ templateId: 'template-1', draftId: 'draft-1' })
  })

  it('rejects the old unwrapped response shape', () => {
    expect(parseCreatedTemplateResponse({ templateId: 'template-1', draftId: 'draft-1' })).toBeNull()
  })
})
