import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { auditTalentReportExport, listTalentReport, talentReportCsv } from '@/lib/talent/report-service'
import { talentReportQuerySchema } from '@/lib/talent/report-schemas'
import { requirePermission } from '@/lib/auth/permissions'

export async function GET(request: Request) {
  try {
    const parsed = talentReportQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()))
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_INPUT_INVALID' }, { status: 400 })
    if (parsed.data.mode === 'self') await requirePermission('self:talent-export:read')
    else await requirePermission('talent-export:read')
    const report = await listTalentReport(parsed.data.mode, parsed.data)
    await auditTalentReportExport(parsed.data.mode, parsed.data, report.goals.length + report.capabilities.length)
    return new Response(talentReportCsv(report), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="talent-report.csv"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_EXPORT_FAILED')
  }
}
