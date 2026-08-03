import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { listTalentReport } from '@/lib/talent/report-service'
import { talentReportQuerySchema } from '@/lib/talent/report-schemas'

export async function GET(request: Request) {
  try {
    const parsed = talentReportQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()))
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await listTalentReport(parsed.data.mode, parsed.data) })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_REPORT_READ_FAILED')
  }
}
