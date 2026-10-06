import { NextResponse } from 'next/server'
import { ControlledActionError } from './service'

export function controlledActionErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof ControlledActionError)) return null
  return NextResponse.json({ error: error.code }, { status: error.status })
}
