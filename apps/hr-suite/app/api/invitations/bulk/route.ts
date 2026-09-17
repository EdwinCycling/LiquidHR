import { NextRequest, NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { bulkInvitationRequestSchema } from '@/lib/auth/bulk-invitation-request'
import { employeeBulkInvitationRequestSchema } from '@/lib/auth/employee-invitation-request'
import { createBulkEmployeeInvitations, createBulkInvitations, type BulkInvitationSummary } from '@/lib/auth/bulk-invitations'
import { resolveRequestOrigin } from '@/lib/auth/request-origin'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: { code: 'INVALID_JSON' } }, { status: 400 })
  }

  try {
    const origin = resolveRequestOrigin({
      canonicalUrl: process.env.NEXT_PUBLIC_APP_URL,
      fallbackUrl: request.url,
      forwardedHost: request.headers.get('x-forwarded-host'),
      forwardedProtocol: request.headers.get('x-forwarded-proto'),
      host: request.headers.get('host') ?? request.nextUrl.host,
    })
    const employeeBatch = employeeBulkInvitationRequestSchema.safeParse(body)
    let summary: BulkInvitationSummary
    if (employeeBatch.success) {
      summary = await createBulkEmployeeInvitations(employeeBatch.data.employeeIds, origin)
    } else {
      const businessBatch = bulkInvitationRequestSchema.safeParse(body)
      if (!businessBatch.success) return NextResponse.json({ error: { code: 'INVALID_INVITATION_BATCH' } }, { status: 400 })
      summary = await createBulkInvitations(
        businessBatch.data.items.map((item) => ({
          ...item,
          employeeId: item.employeeId ?? null,
          administrationId: item.administrationId ?? null,
        })),
        origin,
      )
    }
    return NextResponse.json({ data: summary }, { status: summary.failed > 0 ? 207 : 201 })
  } catch (error) {
    const permissionResponse = permissionErrorResponse(error)
    if (permissionResponse) return permissionResponse
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 })
  }
}
