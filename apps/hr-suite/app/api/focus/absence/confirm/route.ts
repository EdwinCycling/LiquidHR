import { NextResponse } from 'next/server'
import { z } from 'zod'
import { confirmAbsenceConfirmation } from '@/lib/absence/confirmation-service'
import { permissionErrorResponse } from '@/lib/auth/permissions'

const inputSchema = z.object({ caseId: z.string().uuid() }).strict()

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const parsed = inputSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'ABSENCE_CONFIRMATION_INPUT_INVALID' }, { status: 400 })
    const confirmationId = await confirmAbsenceConfirmation(parsed.data.caseId)
    return NextResponse.json({ data: confirmationId })
  } catch (error) {
    const denied = permissionErrorResponse(error)
    if (denied) return denied
    return NextResponse.json({ error: error instanceof Error ? error.message : 'ABSENCE_CONFIRMATION_FAILED' }, { status: 403 })
  }
}
