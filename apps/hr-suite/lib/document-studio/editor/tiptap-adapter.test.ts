// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { canonicalToEditorJson, editorJsonToCanonical, sanitizePastedHtml } from './tiptap-adapter'
import { emptyCanonicalDocument } from '../canonical-document'

describe('Document Studio Tiptap adapter', () => {
  it('keeps atom placeholders atomic across the canonical adapter boundary', () => {
    const base = emptyCanonicalDocument('DOCUMENT')
    const document = { ...base, regions: { ...base.regions, body: { type: 'region' as const, content: [{ type: 'paragraph' as const, attrs: { align: 'LEFT' as const }, content: [{ type: 'knownPlaceholder' as const, attrs: { field: 'employee.first_name' } }, { type: 'text' as const, text: ' — ' }, { type: 'freePlaceholder' as const, attrs: { key: 'LetterSubject' } }] }] } } }
    const editorJson = canonicalToEditorJson(document)
    expect(editorJson.content?.[0]?.content?.[0]?.type).toBe('knownPlaceholder')
    expect(editorJsonToCanonical(editorJson, base)).toEqual(document)
  })

  it('removes active content and non-table attributes from pasted HTML', () => {
    const sanitized = sanitizePastedHtml('<p onclick="alert(1)">Hello <strong>world</strong></p><script>alert(2)</script><img src="https://evil.invalid/x.png">')
    expect(sanitized).toContain('Hello')
    expect(sanitized).not.toContain('onclick')
    expect(sanitized).not.toContain('<script')
    expect(sanitized).not.toContain('<img')
    expect(sanitized).not.toContain('evil.invalid')
  })
})
