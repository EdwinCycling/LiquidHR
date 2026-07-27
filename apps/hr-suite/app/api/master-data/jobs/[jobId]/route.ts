import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { jobUpdateSchema } from '@/lib/master-data/schemas'
import { deleteJob, MasterDataError, updateJob } from '@/lib/master-data/service'

function failure(error: unknown): NextResponse {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof MasterDataError) return NextResponse.json({ code: error.code }, { status: error.status })
  return NextResponse.json({ code: 'MASTER_DATA_FAILED' }, { status: 500 })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ jobId: string }> }): Promise<NextResponse> {
  try {
    const parsed = jobUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ code: 'MASTER_DATA_INPUT_INVALID' }, { status: 400 })
    await updateJob((await params).jobId, parsed.data)
    return new NextResponse(null, { status: 204 })
  } catch (error) { return failure(error) }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ jobId: string }> }): Promise<NextResponse> {
  try {
    await deleteJob((await params).jobId)
    return new NextResponse(null, { status: 204 })
  } catch (error) { return failure(error) }
}
