import { NextResponse } from 'next/server'
import { continuousAppraisalErrorResponse } from '@/lib/continuous-appraisal/route'
import { continuousAppraisalAttachmentIdSchema } from '@/lib/continuous-appraisal/schemas'
import { createContinuousAppraisalAttachment } from '@/lib/continuous-appraisal/service'

type RouteContext = { params: Promise<{ itemId: string }> }

export async function POST(request: Request, context: RouteContext) {
  try {
    const { itemId } = await context.params
    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'CONTINUOUS_APPRAISAL_ATTACHMENT_INVALID' }, { status: 400 })
    const attachmentId = continuousAppraisalAttachmentIdSchema.parse(formData.get('attachmentId') ?? undefined)
    return NextResponse.json(await createContinuousAppraisalAttachment(itemId, file, attachmentId), { status: 201 })
  } catch (error) {
    return continuousAppraisalErrorResponse(error)
  }
}
