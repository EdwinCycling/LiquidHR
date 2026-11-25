import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { PerformanceReviewError } from './service'

export function performanceReviewErrorResponse(error: unknown) {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof PerformanceReviewError) return NextResponse.json({ error: error.code }, { status: error.status })
  if (error instanceof Error && error.name === 'ZodError') return NextResponse.json({ error: 'PERFORMANCE_REVIEW_INVALID_INPUT' }, { status: 400 })
  return NextResponse.json({ error: 'PERFORMANCE_REVIEW_OPERATION_FAILED' }, { status: 500 })
}
