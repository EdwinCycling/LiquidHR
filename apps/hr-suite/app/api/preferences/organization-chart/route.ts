import { NextResponse } from 'next/server'
import { saveOrganizationChartFilter } from '@/lib/preferences/organization-chart'

export async function PATCH(request: Request) {
  const body: unknown = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
  const input = body as Record<string, unknown>
  const filter: Record<string, string> = {}
  for (const key of ['date', 'q', 'department', 'role', 'field', 'value']) {
    if (typeof input[key] === 'string' && input[key].trim().length <= 160) filter[key] = input[key].trim()
  }
  const saved = await saveOrganizationChartFilter(filter)
  if (!saved) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  return NextResponse.json({ ok: true })
}
