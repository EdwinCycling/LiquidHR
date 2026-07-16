import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { saveDashboardLayout } from '@/lib/dashboard/service'

interface Params { params: Promise<{ dashboardId: string }> }
export async function PUT(request: Request, { params }: Params): Promise<NextResponse> {
  try { const { dashboardId } = await params; const data = await saveDashboardLayout(dashboardId, await request.json()); return data ? NextResponse.json({ data }) : NextResponse.json({ error: 'DASHBOARD_NOT_FOUND' }, { status: 404 }) }
  catch (error) { const status = error instanceof Error && error.message === 'DASHBOARD_LAYOUT_INVALID' ? 400 : 500; return permissionErrorResponse(error) ?? NextResponse.json({ error: error instanceof Error ? error.message : 'DASHBOARD_OPERATION_FAILED' }, { status }) }
}
