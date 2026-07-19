import { NextResponse } from 'next/server'
import { AuthorizationError } from '@/lib/auth/permissions'
import { dashboardWidgetSettingUpdateSchema, listDashboardWidgetSettings, updateDashboardWidgetSetting } from '@/lib/dashboard/widget-settings-service'

export async function GET() {
  try { return NextResponse.json(await listDashboardWidgetSettings()) }
  catch (error) { if (error instanceof AuthorizationError) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 }); throw error }
}

export async function PUT(request: Request) {
  try {
    const parsed = dashboardWidgetSettingUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
    await updateDashboardWidgetSetting(parsed.data)
    return NextResponse.json({ ok: true })
  } catch (error) { if (error instanceof AuthorizationError) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 }); return NextResponse.json({ error: error instanceof Error ? error.message : 'DASHBOARD_WIDGET_SAVE_FAILED' }, { status: 400 }) }
}
