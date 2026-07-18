import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { salaryRevisionSchema } from '@/lib/master-data/schemas'
import { MasterDataError, publishSalaryRevision } from '@/lib/master-data/service'

interface RouteContext { params: Promise<{ scaleId: string }> }
export async function POST(request: Request, context: RouteContext) {
  try {
    const { scaleId } = await context.params
    const parsed = salaryRevisionSchema.safeParse({ ...(await request.json()), scaleId })
    if (!parsed.success) return NextResponse.json({ code: 'MASTER_DATA_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await publishSalaryRevision(parsed.data) } }, { status: 201 })
  } catch (error) {
    const permission = permissionErrorResponse(error); if (permission) return permission
    if (error instanceof MasterDataError) return NextResponse.json({ code: error.code }, { status: error.status })
    throw error
  }
}
