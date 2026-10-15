import { NextResponse } from 'next/server'
import { continuousAppraisalErrorResponse } from '@/lib/continuous-appraisal/route'
import { continuousAppraisalStatusTransitionSchema } from '@/lib/continuous-appraisal/schemas'
import { transitionContinuousAppraisalItemStatus } from '@/lib/continuous-appraisal/service'

type RouteContext = { params: Promise<{ itemId: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { itemId } = await context.params
    const input = continuousAppraisalStatusTransitionSchema.parse(await request.json())
    return NextResponse.json(await transitionContinuousAppraisalItemStatus(itemId, input))
  } catch (error) {
    return continuousAppraisalErrorResponse(error)
  }
}
