import { NextResponse } from 'next/server'
import { HeRaProviderError } from './gemini'
import { HeRaServiceError } from './service'

export function heRaErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof HeRaServiceError) {
    const status = error.code === 'DRAFT_NOT_CONFIRMABLE' ? 409 : 500
    return NextResponse.json({ error: error.code }, { status })
  }
  if (error instanceof HeRaProviderError) {
    return NextResponse.json({ error: error.code }, { status: 503 })
  }
  return null
}
