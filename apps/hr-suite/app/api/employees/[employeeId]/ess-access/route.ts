import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { setEmployeeEssAccess } from '@/lib/auth/employee-ess-access'

const requestSchema = z.object({ status: z.enum(['ACTIVE', 'BLOCKED']) }).strict()

function rpcErrorResponse(error: unknown): NextResponse | null {
  if (!error || typeof error !== 'object' || !('message' in error) || typeof error.message !== 'string') return null
  const message = error.message
  const knownErrors: Record<string, { status: number; code: string }> = {
    EMPLOYEE_NOT_FOUND: { status: 404, code: 'EMPLOYEE_NOT_FOUND' },
    EMPLOYEE_NOT_ACTIVATED: { status: 409, code: 'EMPLOYEE_NOT_ACTIVATED' },
    EMPLOYEE_ESS_ACCESS_FORBIDDEN: { status: 403, code: 'EMPLOYEE_ESS_ACCESS_FORBIDDEN' },
    EMPLOYEE_ESS_ACCESS_STATUS_INVALID: { status: 400, code: 'INVALID_ESS_ACCESS_STATUS' },
  }
  const matched = Object.entries(knownErrors).find(([knownError]) => message.includes(knownError))?.[1]
  return matched ? NextResponse.json({ error: matched.code }, { status: matched.status }) : null
}

export async function PATCH(request: Request, { params }: { params: Promise<{ employeeId: string }> }) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_ESS_ACCESS_STATUS' }, { status: 400 })
  const { employeeId } = await params

  try {
    const status = await setEmployeeEssAccess(employeeId, parsed.data.status)
    return NextResponse.json({ data: { employeeId, status } })
  } catch (error) {
    const permissionResponse = permissionErrorResponse(error)
    if (permissionResponse) return permissionResponse
    return rpcErrorResponse(error) ?? NextResponse.json({ error: 'ESS_ACCESS_UPDATE_FAILED' }, { status: 500 })
  }
}
