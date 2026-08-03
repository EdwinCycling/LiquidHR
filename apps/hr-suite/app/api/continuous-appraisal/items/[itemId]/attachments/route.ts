import { NextResponse } from 'next/server'
import { continuousAppraisalErrorResponse } from '@/lib/continuous-appraisal/route'
import { createContinuousAppraisalAttachment } from '@/lib/continuous-appraisal/service'

type RouteContext = { params: Promise<{ itemId: string }> }

export async function POST(request: Request, context: RouteContext) {
  try {
    const { itemId } = await context.params
    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'CONTINUOUS_APPRAISAL_ATTACHMENT_INVALID' }, { status: 400 })
    return NextResponse.json(await createContinuousAppraisalAttachment(itemId, file), { status: 201 })
  } catch (error) {
    return continuousAppraisalErrorResponse(error)
  }
}
