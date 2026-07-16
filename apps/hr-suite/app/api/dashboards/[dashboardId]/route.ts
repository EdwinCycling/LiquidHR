import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { deleteDashboard, duplicateDashboard, renameDashboard } from '@/lib/dashboard/service'
import { dashboardRenameSchema } from '@/lib/dashboard/schemas'

interface Params { params: Promise<{ dashboardId: string }> }
export async function PATCH(request: Request, { params }: Params): Promise<NextResponse> {
  try { const parsed = dashboardRenameSchema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: 'DASHBOARD_INPUT_INVALID' }, { status: 400 }); const { dashboardId } = await params; const data = await renameDashboard(dashboardId, parsed.data); return data ? NextResponse.json({ data }) : NextResponse.json({ error: 'DASHBOARD_NOT_FOUND' }, { status: 404 }) }
  catch (error) { return permissionErrorResponse(error) ?? NextResponse.json({ error: 'DASHBOARD_OPERATION_FAILED' }, { status: 500 }) }
}
export async function POST(_: Request, { params }: Params): Promise<NextResponse> {
  try { const { dashboardId } = await params; const data = await duplicateDashboard(dashboardId); return data ? NextResponse.json({ data }, { status: 201 }) : NextResponse.json({ error: 'DASHBOARD_NOT_FOUND' }, { status: 404 }) }
  catch (error) { return permissionErrorResponse(error) ?? NextResponse.json({ error: 'DASHBOARD_OPERATION_FAILED' }, { status: 500 }) }
}
export async function DELETE(_: Request, { params }: Params): Promise<NextResponse> {
  try { const { dashboardId } = await params; return (await deleteDashboard(dashboardId)) ? NextResponse.json({ data: { id: dashboardId } }) : NextResponse.json({ error: 'DASHBOARD_NOT_FOUND' }, { status: 404 }) }
  catch (error) { const status = error instanceof Error && error.message === 'DASHBOARD_LAST_DELETE_FORBIDDEN' ? 409 : 500; return permissionErrorResponse(error) ?? NextResponse.json({ error: error instanceof Error ? error.message : 'DASHBOARD_OPERATION_FAILED' }, { status }) }
}
