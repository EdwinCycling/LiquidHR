import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { ModuleError } from '@/lib/modules/module-service'

export class ResearchError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code)
    this.name = 'ResearchError'
  }
}

export function researchErrorResponse(error: unknown): NextResponse {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof ModuleError) return NextResponse.json({ error: error.code }, { status: error.status })
  if (error instanceof ResearchError) return NextResponse.json({ error: error.code }, { status: error.status })
  return NextResponse.json({ error: 'RESEARCH_OPERATION_FAILED' }, { status: 500 })
}
