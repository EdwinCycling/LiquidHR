import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import {
  getInternalTransferPreview,
  internalTransferErrorResponse,
} from '@/lib/process-automation/internal-transfer-service'

interface Params { params: Promise<{ workItemId: string }> }

export async function GET(_request: Request, { params }: Params): Promise<NextResponse> {
  try {
    const { workItemId } = await params
    return NextResponse.json({ data: await getInternalTransferPreview(workItemId) })
  } catch (error) {
    return permissionErrorResponse(error)
      ?? internalTransferErrorResponse(error)
      ?? NextResponse.json({ code: 'INTERNAL_TRANSFER_OPERATION_FAILED' }, { status: 500 })
  }
}
