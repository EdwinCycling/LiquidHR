import { describe, expect, it } from 'vitest'
import { GET } from './route'

describe('GET /api/organization-chart', () => {
  it('weigert een ongeldige peildatum voordat data wordt geladen', async () => {
    const response = await GET(new Request('http://localhost/api/organization-chart?date=16-07-2026'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ code: 'ORGANIZATION_CHART_INPUT_INVALID' })
  })

  it('weigert een onvolledige vrije-veldfilter', async () => {
    const response = await GET(new Request(`http://localhost/api/organization-chart?date=2026-07-16&field=${crypto.randomUUID()}`))

    expect(response.status).toBe(400)
  })

  it('weigert een ongeldige view voordat data wordt geladen', async () => {
    const response = await GET(new Request('http://localhost/api/organization-chart?view=invalid&date=2026-07-16'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ code: 'ORGANIZATION_CHART_INPUT_INVALID' })
  })
})
