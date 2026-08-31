import { NextRequest, NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { invitationRequestSchema } from '@/lib/auth/invitation-request'
import { InvitationError } from '@/lib/auth/invitation-rules'
import { createInvitation } from '@/lib/auth/invitations'
import { resolveRequestOrigin } from '@/lib/auth/request-origin'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: { code: 'INVALID_JSON' } }, { status: 400 })
  }

  const parsed = invitationRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'INVALID_INVITATION' } }, { status: 400 })
  }

  try {
    const invitation = await createInvitation({
      ...parsed.data,
      employeeId: parsed.data.employeeId ?? null,
      administrationId: parsed.data.administrationId ?? null,
      origin: resolveRequestOrigin({
        canonicalUrl: process.env.NEXT_PUBLIC_APP_URL,
        fallbackUrl: request.url,
        forwardedHost: request.headers.get('x-forwarded-host'),
        forwardedProtocol: request.headers.get('x-forwarded-proto'),
        host: request.headers.get('host') ?? request.nextUrl.host,
      }),
    })

    return NextResponse.json({ data: invitation }, { status: 201 })
  } catch (error) {
    if (error instanceof InvitationError) {
      return NextResponse.json({ error: { code: error.code } }, { status: error.status })
    }

    const permissionResponse = permissionErrorResponse(error)
    if (permissionResponse) return permissionResponse

    return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 })
  }
}
