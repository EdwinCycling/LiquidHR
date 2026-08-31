import { NextResponse } from 'next/server'
import {
  createSavedAnalysis,
  listMySavedAnalyses,
} from '@/lib/insights/saved-analysis-service'
import { savedAnalysisErrorResponse } from '@/lib/insights/saved-analysis-http'

const noStoreHeaders = { 'Cache-Control': 'no-store' }

export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json({ data: await listMySavedAnalyses() }, { headers: noStoreHeaders })
  } catch (error) {
    return savedAnalysisErrorResponse(error, 'SAVED_ANALYSIS_READ_FAILED')
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'SAVED_ANALYSIS_INPUT_INVALID' }, { headers: noStoreHeaders, status: 400 })
  }

  try {
    return NextResponse.json({ data: await createSavedAnalysis(body) }, { headers: noStoreHeaders, status: 201 })
  } catch (error) {
    return savedAnalysisErrorResponse(error, 'SAVED_ANALYSIS_SAVE_FAILED')
  }
}
