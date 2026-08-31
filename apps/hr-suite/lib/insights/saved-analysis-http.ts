import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { AnalysisEngineError } from '@/lib/insights/analysis-errors'
import { SavedAnalysisError } from '@/lib/insights/saved-analysis-errors'

const noStoreHeaders = { 'Cache-Control': 'no-store' }

export function savedAnalysisErrorResponse(
  error: unknown,
  fallback: 'SAVED_ANALYSIS_READ_FAILED' | 'SAVED_ANALYSIS_SAVE_FAILED' | 'SAVED_ANALYSIS_UPDATE_FAILED' | 'SAVED_ANALYSIS_DELETE_FAILED',
): NextResponse {
  const permissionResponse = permissionErrorResponse(error)
  if (permissionResponse) {
    permissionResponse.headers.set('Cache-Control', 'no-store')
    return permissionResponse
  }
  if (error instanceof SavedAnalysisError) {
    return NextResponse.json({ error: error.code }, { headers: noStoreHeaders, status: error.status })
  }
  if (error instanceof AnalysisEngineError) {
    return NextResponse.json({ error: error.code }, { headers: noStoreHeaders, status: error.status })
  }
  return NextResponse.json({ error: fallback }, { headers: noStoreHeaders, status: 500 })
}
