import { NextResponse } from 'next/server'
import { continuousAppraisalErrorResponse } from '@/lib/continuous-appraisal/route'
import { continuousAppraisalCreateSchema, continuousAppraisalListQuerySchema } from '@/lib/continuous-appraisal/schemas'
import { createContinuousAppraisalItem, listContinuousAppraisalWorkspace } from '@/lib/continuous-appraisal/service'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const parsed = continuousAppraisalListQuerySchema.parse({
      employeeId: url.searchParams.get('employeeId') ?? undefined,
      search: url.searchParams.get('search') ?? undefined,
      itemType: url.searchParams.get('itemType') ?? undefined,
      itemStatus: url.searchParams.get('itemStatus') ?? undefined,
    })
    if (!parsed.employeeId) return NextResponse.json({ error: 'CONTINUOUS_APPRAISAL_EMPLOYEE_REQUIRED' }, { status: 400 })
    return NextResponse.json(await listContinuousAppraisalWorkspace(parsed.employeeId, parsed))
  } catch (error) {
    return continuousAppraisalErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const input = continuousAppraisalCreateSchema.parse(await request.json())
    return NextResponse.json(await createContinuousAppraisalItem(input), { status: 201 })
  } catch (error) {
    return continuousAppraisalErrorResponse(error)
  }
}
