import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { getMyTalentProfile, TalentServiceError } from '@/lib/talent/service'

export async function GET() {
  try {
    return NextResponse.json({ data: await getMyTalentProfile() })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof TalentServiceError) return NextResponse.json({ error: error.code }, { status: error.status })
    return NextResponse.json({ error: 'MY_TALENT_READ_FAILED' }, { status: 500 })
  }
}
