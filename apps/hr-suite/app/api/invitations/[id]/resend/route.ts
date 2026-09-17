import { NextRequest, NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { InvitationError } from '@/lib/auth/invitation-rules'
import { resendInvitation } from '@/lib/auth/invitation-management'
import { resolveRequestOrigin } from '@/lib/auth/request-origin'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const invitation = await resendInvitation(id, resolveRequestOrigin({
      canonicalUrl: process.env.NEXT_PUBLIC_APP_URL,
      fallbackUrl: request.url,
      forwardedHost: request.headers.get('x-forwarded-host'),
      forwardedProtocol: request.headers.get('x-forwarded-proto'),
      host: request.headers.get('host') ?? request.nextUrl.host,
    }))
    return NextResponse.json({ data: invitation }, { status: 201 })
  } catch (error) {
    if (error instanceof InvitationError) return NextResponse.json({ error: { code: error.code } }, { status: error.status })
    const permissionResponse = permissionErrorResponse(error)
    if (permissionResponse) return permissionResponse
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 })
  }
}
