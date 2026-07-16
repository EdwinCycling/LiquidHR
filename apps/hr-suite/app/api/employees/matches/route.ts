import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { EmploymentServiceError, findIdentityCandidates } from '@/lib/employment/employment-service'
import { identityMatchSchema } from '@/lib/employment/schemas'

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const parsed = identityMatchSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ code: 'IDENTITY_INPUT_INVALID' }, { status: 400 })
    }
    const candidates = await findIdentityCandidates(parsed.data)
    return NextResponse.json({ data: candidates, resolutionRequired: candidates.length > 0 })
  } catch (error) {
    const permissionResponse = permissionErrorResponse(error)
    if (permissionResponse) return permissionResponse
    if (error instanceof EmploymentServiceError) {
      return NextResponse.json({ code: error.code }, { status: error.status })
    }
    throw error
  }
}
