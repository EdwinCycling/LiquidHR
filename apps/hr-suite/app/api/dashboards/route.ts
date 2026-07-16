import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { createDashboard, getDashboardView, listPersonalDashboards } from '@/lib/dashboard/service'
import { dashboardCreateSchema } from '@/lib/dashboard/schemas'

export async function GET(request: Request): Promise<NextResponse> {
  try { const id = new URL(request.url).searchParams.get('id') ?? undefined; return NextResponse.json({ data: { dashboards: await listPersonalDashboards(), view: await getDashboardView(id) } }) }
  catch (error) { return permissionErrorResponse(error) ?? NextResponse.json({ error: 'DASHBOARD_OPERATION_FAILED' }, { status: 500 }) }
}
export async function POST(request: Request): Promise<NextResponse> {
  try { const parsed = dashboardCreateSchema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: 'DASHBOARD_INPUT_INVALID' }, { status: 400 }); return NextResponse.json({ data: await createDashboard(parsed.data) }, { status: 201 }) }
  catch (error) { return permissionErrorResponse(error) ?? NextResponse.json({ error: 'DASHBOARD_OPERATION_FAILED' }, { status: 500 }) }
}
