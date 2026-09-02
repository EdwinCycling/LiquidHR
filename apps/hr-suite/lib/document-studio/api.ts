import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { DocumentStudioServiceError } from './service'

export function documentStudioErrorResponse(error: unknown): NextResponse | null {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof DocumentStudioServiceError) {
    return NextResponse.json({ code: error.code, errors: error.issues }, { status: error.status })
  }
  return null
}

export async function readJson(request: Request): Promise<unknown> {
  try { return await request.json() } catch { return null }
}
