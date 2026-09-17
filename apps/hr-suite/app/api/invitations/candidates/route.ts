import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { listInvitationCandidates } from '@/lib/auth/invitation-management'

export async function GET() {
  try {
    return NextResponse.json({ data: await listInvitationCandidates() })
  } catch (error) {
    const permissionResponse = permissionErrorResponse(error)
    if (permissionResponse) return permissionResponse
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 })
  }
}
