import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { updateActualWorkType } from '@/lib/actual-work/actual-work-service'

export async function PATCH(request: Request, { params }: { params: Promise<{ typeId: string }> }) {
  try {
    const { typeId } = await params
    return NextResponse.json({ data: await updateActualWorkType(typeId, await request.json()) })
  } catch (error) {
    const response = permissionErrorResponse(error)
    if (response) return response
    return NextResponse.json({ error: error instanceof Error ? error.message : 'ACTUAL_WORK_TYPE_UPDATE_FAILED' }, { status: 400 })
  }
}
