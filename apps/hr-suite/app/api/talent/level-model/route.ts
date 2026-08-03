import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { getTalentLevelModel } from '@/lib/talent/service'

export async function GET() {
  try { return NextResponse.json({ data: await getTalentLevelModel() }) }
  catch (error) { return talentErrorResponse(error, 'TALENT_LEVEL_MODEL_READ_FAILED') }
}
