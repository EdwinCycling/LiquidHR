import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import {
  EmploymentDetailError,
  manageEmploymentCompanyLocation,
} from '@/lib/employment/employment-detail-service'
import { companyLocationMutationSchema } from '@/lib/employment/company-location-schemas'

interface RouteContext { params: Promise<{ employmentId: string }> }

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const parsed = companyLocationMutationSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ code: 'COMPANY_LOCATION_INPUT_INVALID' }, { status: 400 })
    const { employmentId } = await context.params
    const id = await manageEmploymentCompanyLocation(employmentId, parsed.data)
    return NextResponse.json({ data: { id } }, { status: parsed.data.placementId ? 200 : 201 })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof EmploymentDetailError) {
      return NextResponse.json({ code: error.code }, { status: error.status })
    }
    throw error
  }
}
