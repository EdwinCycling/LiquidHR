import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { jobGroupUpdateSchema } from '@/lib/master-data/schemas'
import { deleteJobGroup, MasterDataError, updateJobGroup } from '@/lib/master-data/service'

function failure(error: unknown): NextResponse {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof MasterDataError) return NextResponse.json({ code: error.code }, { status: error.status })
  return NextResponse.json({ code: 'MASTER_DATA_FAILED' }, { status: 500 })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ groupId: string }> }): Promise<NextResponse> {
  try {
    const parsed = jobGroupUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ code: 'MASTER_DATA_INPUT_INVALID' }, { status: 400 })
    await updateJobGroup((await params).groupId, parsed.data)
    return new NextResponse(null, { status: 204 })
  } catch (error) { return failure(error) }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ groupId: string }> }): Promise<NextResponse> {
  try {
    await deleteJobGroup((await params).groupId)
    return new NextResponse(null, { status: 204 })
  } catch (error) { return failure(error) }
}
