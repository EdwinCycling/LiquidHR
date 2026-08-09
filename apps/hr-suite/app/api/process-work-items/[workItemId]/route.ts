import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { getProcessWorkItemDetail, processWorkErrorResponse } from '@/lib/process-automation/work-service'

const paramsSchema = z.object({ workItemId: z.string().uuid() }).strict()

export async function GET(
  request: Request,
  { params }: { params: Promise<{ workItemId: string }> },
) {
  try {
    const parsedParams = paramsSchema.safeParse(await params)
    if (!parsedParams.success) return NextResponse.json({ code: 'INVALID_WORK_ITEM_ID' }, { status: 400 })
    const language = new URL(request.url).searchParams.get('language') === 'en' ? 'en' : 'nl'
    const data = await getProcessWorkItemDetail(parsedParams.data.workItemId, language)
    return NextResponse.json({ data })
  } catch (error) {
    return processWorkErrorResponse(error)
      ?? permissionErrorResponse(error)
      ?? NextResponse.json({ code: 'PROCESS_WORK_DETAIL_READ_FAILED' }, { status: 500 })
  }
}
