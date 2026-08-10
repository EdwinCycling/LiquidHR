import { NextResponse } from 'next/server'
import { companyActivityErrorResponse, updateCompanyActivity } from '@/lib/company-activities/service'
import { companyActivityUpdateSchema } from '@/lib/company-activities/schemas'

type Context = { params: Promise<{ activityId: string }> }

export async function PATCH(request: Request, context: Context) {
  try {
    const parsed = companyActivityUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'COMPANY_ACTIVITY_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await updateCompanyActivity((await context.params).activityId, parsed.data) })
  } catch (error) {
    return companyActivityErrorResponse(error)
  }
}
