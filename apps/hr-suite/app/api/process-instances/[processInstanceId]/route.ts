import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { getProcessInstanceProjection, processRuntimeErrorResponse } from '@/lib/process-automation/runtime-service'

interface Params {
  params: Promise<{ processInstanceId: string }>
}

export async function GET(_request: Request, { params }: Params): Promise<NextResponse> {
  try {
    const { processInstanceId } = await params
    return NextResponse.json({ data: await getProcessInstanceProjection(processInstanceId) })
  } catch (error) {
    return permissionErrorResponse(error)
      ?? processRuntimeErrorResponse(error)
      ?? NextResponse.json({ code: 'PROCESS_RUNTIME_OPERATION_FAILED' }, { status: 500 })
  }
}
