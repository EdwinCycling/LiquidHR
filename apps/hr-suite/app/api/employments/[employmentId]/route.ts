import { NextResponse } from 'next/server'
import { deleteEmployment, EmploymentDetailError } from '@/lib/employment/employment-detail-service'
import { permissionErrorResponse } from '@/lib/auth/permissions'

export async function DELETE(_request: Request, context: { params: Promise<{ employmentId: string }> }) {
  try {
    const { employmentId } = await context.params
    await deleteEmployment(employmentId)
    return NextResponse.json({ data: { id: employmentId } })
  } catch (error) {
    return permissionErrorResponse(error) ?? NextResponse.json({ error: error instanceof EmploymentDetailError ? error.code : 'EMPLOYMENT_DELETE_FAILED' }, { status: error instanceof EmploymentDetailError ? error.status : 500 })
  }
}
