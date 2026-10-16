import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { getTalentProfileDashboard, TalentServiceError } from '@/lib/talent/service'

export async function GET() {
  try {
    return NextResponse.json({ data: await getTalentProfileDashboard() })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof TalentServiceError) return NextResponse.json({ error: error.code }, { status: error.status })
    return NextResponse.json({ error: 'TALENT_PROFILE_DASHBOARD_READ_FAILED' }, { status: 500 })
  }
}