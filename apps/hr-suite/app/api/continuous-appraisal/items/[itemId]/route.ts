import { NextResponse } from 'next/server'
import { continuousAppraisalErrorResponse } from '@/lib/continuous-appraisal/route'
import { continuousAppraisalDeleteSchema, continuousAppraisalUpdateSchema } from '@/lib/continuous-appraisal/schemas'
import { softDeleteContinuousAppraisalItem, updateContinuousAppraisalItem } from '@/lib/continuous-appraisal/service'

type RouteContext = { params: Promise<{ itemId: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { itemId } = await context.params
    const input = continuousAppraisalUpdateSchema.parse(await request.json())
    return NextResponse.json(await updateContinuousAppraisalItem(itemId, input))
  } catch (error) {
    return continuousAppraisalErrorResponse(error)
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { itemId } = await context.params
    const input = continuousAppraisalDeleteSchema.parse(await request.json())
    return NextResponse.json(await softDeleteContinuousAppraisalItem(itemId, input))
  } catch (error) {
    return continuousAppraisalErrorResponse(error)
  }
}
