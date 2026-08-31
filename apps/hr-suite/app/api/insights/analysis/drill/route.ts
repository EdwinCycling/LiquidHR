import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { executeAnalysisDrill } from '@/lib/insights/analysis-drill-runtime'
import { AnalysisEngineError } from '@/lib/insights/analysis-errors'

const noStoreHeaders = { 'Cache-Control': 'no-store' }

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'ANALYSIS_DRILL_INVALID_REQUEST' }, { headers: noStoreHeaders, status: 400 })
  }

  try {
    const data = await executeAnalysisDrill(body)
    return NextResponse.json({ data }, { headers: noStoreHeaders })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof AnalysisEngineError) {
      return NextResponse.json({ error: error.code }, { headers: noStoreHeaders, status: error.status })
    }
    return NextResponse.json({ error: 'ANALYSIS_EXECUTION_FAILED' }, { headers: noStoreHeaders, status: 500 })
  }
}
