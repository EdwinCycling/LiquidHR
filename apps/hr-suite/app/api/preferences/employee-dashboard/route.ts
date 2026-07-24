import { NextResponse } from 'next/server'
import { employeeDashboardLayoutJson, parseEmployeeDashboardLayout, saveEmployeeDashboardLayout } from '@/lib/preferences/employee-dashboard'

export async function PATCH(request: Request) {
  const body: unknown = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
  const layout = parseEmployeeDashboardLayout(body)
  const saved = await saveEmployeeDashboardLayout(layout)
  if (!saved) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  return NextResponse.json({ data: employeeDashboardLayoutJson(layout) })
}
