import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { developmentInsightCsv, functionSkillGapReportCsv, gridMovementCsv } from '@/lib/star-performers/insights-service'
import { starPerformerWorkspaceQuerySchema } from '@/lib/star-performers/schemas'
import { StarPerformerError } from '@/lib/star-performers/service'
import { getStarPerformersInsights } from '@/lib/star-performers/v2-service'

function failure(error: unknown) {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof StarPerformerError) return NextResponse.json({ code: error.code }, { status: error.status })
  return null
}

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams
    const parsed = starPerformerWorkspaceQuerySchema.safeParse({
      perspective: searchParams.get('perspective') ?? undefined,
      area: searchParams.get('area') ?? undefined,
      insight: searchParams.get('insight') ?? undefined,
      q: searchParams.get('q') ?? undefined,
      departmentId: searchParams.get('departmentId') ?? undefined,
      jobId: searchParams.get('jobId') ?? undefined,
      jobGroupId: searchParams.get('jobGroupId') ?? undefined,
      period: searchParams.get('period') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
    })
    if (!parsed.success || !['skill-gaps', 'development', 'top-talent'].includes(parsed.data.insight)) return NextResponse.json({ code: 'STAR_PERFORMER_INPUT_INVALID' }, { status: 400 })
    const data = await getStarPerformersInsights(parsed.data)
    if (parsed.data.insight === 'top-talent') {
      return new Response(gridMovementCsv(data.topTalent.history), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="grid-movement.csv"',
          'Cache-Control': 'no-store',
        },
      })
    }
    if (data.skillGaps.state === 'unavailable') return NextResponse.json({ code: 'STAR_PERFORMER_SKILL_GAP_SOURCE_UNAVAILABLE' }, { status: 503 })
    if (parsed.data.insight === 'development') {
      if (data.development.state === 'unavailable') return NextResponse.json({ code: 'STAR_PERFORMER_DEVELOPMENT_SOURCE_UNAVAILABLE' }, { status: 503 })
      return new Response(developmentInsightCsv(data.development), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="development-insights.csv"',
          'Cache-Control': 'no-store',
        },
      })
    }
    return new Response(functionSkillGapReportCsv(data.skillGaps), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="function-skill-gaps.csv"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    const response = failure(error)
    if (response) return response
    throw error
  }
}
