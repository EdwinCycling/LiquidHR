import { researchErrorResponse } from '@/lib/research/errors'
import { exportSurveyCsv } from '@/lib/research/results-service'

interface RouteContext {
  params: Promise<{ campaignId: string }>
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { campaignId } = await params
    const exportData = await exportSurveyCsv(campaignId)
    return new Response(exportData.csv, {
      headers: {
        'content-disposition': `attachment; filename="${exportData.filename}"`,
        'content-type': 'text/csv; charset=utf-8',
        'cache-control': 'private, no-store',
      },
    })
  } catch (error) {
    return researchErrorResponse(error)
  }
}
