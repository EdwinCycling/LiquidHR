import { NextRequest, NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { bulkInvitationRequestSchema } from '@/lib/auth/bulk-invitation-request'
import { createBulkInvitations } from '@/lib/auth/bulk-invitations'
import { resolveRequestOrigin } from '@/lib/auth/request-origin'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: { code: 'INVALID_JSON' } }, { status: 400 })
  }

  const parsed = bulkInvitationRequestSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: { code: 'INVALID_INVITATION_BATCH' } }, { status: 400 })

  try {
    const summary = await createBulkInvitations(
      parsed.data.items.map((item) => ({
        ...item,
        employeeId: item.employeeId ?? null,
        administrationId: item.administrationId ?? null,
      })),
      resolveRequestOrigin({
        canonicalUrl: process.env.NEXT_PUBLIC_APP_URL,
        fallbackUrl: request.url,
        forwardedHost: request.headers.get('x-forwarded-host'),
        forwardedProtocol: request.headers.get('x-forwarded-proto'),
        host: request.headers.get('host') ?? request.nextUrl.host,
      }),
    )
    return NextResponse.json({ data: summary }, { status: summary.failed > 0 ? 207 : 201 })
  } catch (error) {
    const permissionResponse = permissionErrorResponse(error)
    if (permissionResponse) return permissionResponse
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 })
  }
}
