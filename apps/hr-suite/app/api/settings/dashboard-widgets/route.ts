import { NextResponse } from 'next/server'
import { AuthorizationError } from '@/lib/auth/permissions'
import { listDashboardWidgetSettings, updateDashboardWidgetSetting } from '@/lib/dashboard/widget-settings-service'

export async function GET() {
  try { return NextResponse.json(await listDashboardWidgetSettings()) }
  catch (error) { if (error instanceof AuthorizationError) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 }); throw error }
}

export async function PUT(request: Request) {
  try {
    const body: unknown = await request.json()
    if (!body || typeof body !== 'object' || !('widgetType' in body) || !('isEnabled' in body) || !('roleIds' in body)) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
    const input = body as { widgetType: unknown; isEnabled: unknown; roleIds: unknown }
    if (typeof input.widgetType !== 'string' || typeof input.isEnabled !== 'boolean' || !Array.isArray(input.roleIds) || !input.roleIds.every((roleId): roleId is string => typeof roleId === 'string')) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
    await updateDashboardWidgetSetting({ widgetType: input.widgetType, isEnabled: input.isEnabled, roleIds: input.roleIds })
    return NextResponse.json({ ok: true })
  } catch (error) { if (error instanceof AuthorizationError) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 }); return NextResponse.json({ error: error instanceof Error ? error.message : 'DASHBOARD_WIDGET_SAVE_FAILED' }, { status: 400 }) }
}
