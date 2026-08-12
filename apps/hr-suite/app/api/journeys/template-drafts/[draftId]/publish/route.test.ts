import { beforeEach, describe, expect, it, vi } from 'vitest'

const { publishJourneyTemplate } = vi.hoisted(() => ({ publishJourneyTemplate: vi.fn() }))
vi.mock('@/lib/journeys', () => ({ journeyTemplates: { publishJourneyTemplate } }))

import { POST } from './route'

describe('POST Journey template publication', () => {
  beforeEach(() => publishJourneyTemplate.mockResolvedValue({ versionNumber: 2 }))

  it('valideert id en expected revision voordat publicatie wordt aangeroepen', async () => {
    const response = await POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ expectedRevision: 4 }) }), {
      params: Promise.resolve({ draftId: '278923f0-34fd-4c0c-a146-68fcde0f1bdb' }),
    })
    expect(response.status).toBe(200)
    expect(publishJourneyTemplate).toHaveBeenCalledWith('278923f0-34fd-4c0c-a146-68fcde0f1bdb', 4)
  })

  it('weigert een ongeldige revision zonder domeincall', async () => {
    const response = await POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ expectedRevision: 0 }) }), {
      params: Promise.resolve({ draftId: '278923f0-34fd-4c0c-a146-68fcde0f1bdb' }),
    })
    expect(response.status).toBe(400)
    expect(publishJourneyTemplate).not.toHaveBeenCalled()
  })
})
