import { describe, expect, it } from 'vitest'
import { toHeRaExport } from './export'

describe('toHeRaExport', () => {
  it('exporteert zichtbare chatdata zonder secrets of interne metadata', () => {
    const exported = toHeRaExport({
      conversation: { id: 'chat', title: 'Mijn gesprek', createdAt: '2026-07-16T09:00:00.000Z' },
      messages: [{ role: 'ASSISTANT', content: 'Ik help je graag.', createdAt: '2026-07-16T09:01:00.000Z', modelId: 'gemini', systemPrompt: 'secret', rawToolPayload: { secret: 'nooit' } }],
    })

    expect(exported.markdown).toContain('Ik help je graag.')
    expect(exported.markdown).not.toContain('secret')
    expect(JSON.stringify(exported.json)).not.toContain('rawToolPayload')
  })
})
