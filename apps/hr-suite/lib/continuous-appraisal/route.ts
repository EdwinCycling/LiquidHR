import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { ContinuousAppraisalError } from './service'

export function continuousAppraisalErrorResponse(error: unknown, fallback = 'CONTINUOUS_APPRAISAL_OPERATION_FAILED') {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof ContinuousAppraisalError) return NextResponse.json({ error: error.code }, { status: error.status })
  return NextResponse.json({ error: fallback }, { status: 500 })
}
