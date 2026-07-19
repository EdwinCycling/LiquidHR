import { NextResponse } from 'next/server'
import { saveEmployeesListPreferences } from '@/lib/preferences/employees'
import { parseEmployeeListPreferencesPatch } from '@/lib/preferences/employee-list-state'

export async function PATCH(request: Request) {
  const body: unknown = await request.json().catch(() => null)
  const patch = parseEmployeeListPreferencesPatch(body)
  if (!patch) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
  const saved = await saveEmployeesListPreferences(patch)
  if (!saved) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  return NextResponse.json({ ok: true })
}
