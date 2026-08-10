import { NextResponse } from 'next/server'
import { companyActivityErrorResponse, createCompanyActivity, listCompanyActivities } from '@/lib/company-activities/service'
import { companyActivitySchema } from '@/lib/company-activities/schemas'

export async function GET(request: Request) {
  try {
    const year = Number(new URL(request.url).searchParams.get('year'))
    if (!Number.isInteger(year)) return NextResponse.json({ error: 'COMPANY_ACTIVITY_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await listCompanyActivities(year) })
  } catch (error) {
    return companyActivityErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const parsed = companyActivitySchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'COMPANY_ACTIVITY_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await createCompanyActivity(parsed.data) } }, { status: 201 })
  } catch (error) {
    return companyActivityErrorResponse(error)
  }
}
