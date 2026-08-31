import { NextResponse } from 'next/server'
import { getSavedAnalysis, updateSavedAnalysis, deleteSavedAnalysis } from '@/lib/insights/saved-analysis-service'
import { savedAnalysisErrorResponse } from '@/lib/insights/saved-analysis-http'

const noStoreHeaders = { 'Cache-Control': 'no-store' }
type RouteContext = { params: Promise<{ analysisId: string }> }

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { analysisId } = await context.params
    return NextResponse.json({ data: await getSavedAnalysis(analysisId) }, { headers: noStoreHeaders })
  } catch (error) {
    return savedAnalysisErrorResponse(error, 'SAVED_ANALYSIS_READ_FAILED')
  }
}

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'SAVED_ANALYSIS_INPUT_INVALID' }, { headers: noStoreHeaders, status: 400 })
  }

  try {
    const { analysisId } = await context.params
    return NextResponse.json({ data: await updateSavedAnalysis(analysisId, body) }, { headers: noStoreHeaders })
  } catch (error) {
    return savedAnalysisErrorResponse(error, 'SAVED_ANALYSIS_UPDATE_FAILED')
  }
}

export async function DELETE(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { analysisId } = await context.params
    return NextResponse.json({ data: await deleteSavedAnalysis(analysisId) }, { headers: noStoreHeaders })
  } catch (error) {
    return savedAnalysisErrorResponse(error, 'SAVED_ANALYSIS_DELETE_FAILED')
  }
}
