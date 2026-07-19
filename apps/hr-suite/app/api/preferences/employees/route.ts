import { NextResponse } from 'next/server'
import { saveEmployeesFilterPanelOpen } from '@/lib/preferences/employees'

export async function PATCH(request: Request) {
  const body: unknown = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
  const input = body as Record<string, unknown>
  if (typeof input.filterPanelOpen !== 'boolean') return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
  const saved = await saveEmployeesFilterPanelOpen(input.filterPanelOpen)
  if (!saved) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  return NextResponse.json({ ok: true })
}
