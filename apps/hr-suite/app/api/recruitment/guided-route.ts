import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { RecruitmentError } from '@/lib/recruitment/errors'

export function guidedErrorResponse(error: unknown): NextResponse {
  return permissionErrorResponse(error)
    ?? (error instanceof RecruitmentError
      ? NextResponse.json({ code: error.code }, { status: error.status })
      : NextResponse.json({ code: 'RECRUITMENT_OPERATION_FAILED' }, { status: 500 }))
}

export function invalidGuidedInput(code = 'RECRUITMENT_GUIDED_INPUT_INVALID'): NextResponse {
  return NextResponse.json({ code }, { status: 400 })
}
