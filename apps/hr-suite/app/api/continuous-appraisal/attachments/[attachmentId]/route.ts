import { NextResponse } from 'next/server'
import { continuousAppraisalErrorResponse } from '@/lib/continuous-appraisal/route'
import { getContinuousAppraisalAttachmentDownload } from '@/lib/continuous-appraisal/service'

type RouteContext = { params: Promise<{ attachmentId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { attachmentId } = await context.params
    return NextResponse.redirect(await getContinuousAppraisalAttachmentDownload(attachmentId))
  } catch (error) {
    return continuousAppraisalErrorResponse(error)
  }
}
