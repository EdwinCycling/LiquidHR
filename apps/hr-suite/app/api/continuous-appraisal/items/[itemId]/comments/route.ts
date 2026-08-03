import { NextResponse } from 'next/server'
import { continuousAppraisalErrorResponse } from '@/lib/continuous-appraisal/route'
import { continuousAppraisalCommentSchema } from '@/lib/continuous-appraisal/schemas'
import { addContinuousAppraisalComment } from '@/lib/continuous-appraisal/service'

type RouteContext = { params: Promise<{ itemId: string }> }

export async function POST(request: Request, context: RouteContext) {
  try {
    const { itemId } = await context.params
    const input = continuousAppraisalCommentSchema.parse(await request.json())
    return NextResponse.json(await addContinuousAppraisalComment(itemId, input), { status: 201 })
  } catch (error) {
    return continuousAppraisalErrorResponse(error)
  }
}
