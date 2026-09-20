import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { InvitationError } from '@/lib/auth/invitation-rules'
import { revokeInvitation } from '@/lib/auth/invitation-management'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    await revokeInvitation(id)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    if (error instanceof InvitationError) return NextResponse.json({ error: { code: error.code } }, { status: error.status })
    const permissionResponse = permissionErrorResponse(error)
    if (permissionResponse) return permissionResponse
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 })
  }
}
