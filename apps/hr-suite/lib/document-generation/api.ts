import 'server-only'
import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { DocumentGenerationError } from './service'

export function documentGenerationErrorResponse(error: unknown): NextResponse | null {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof DocumentGenerationError) {
    return NextResponse.json({ code: error.code, details: error.details }, { status: error.status })
  }
  return null
}
