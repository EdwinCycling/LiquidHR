import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { formLanguageSchema, formRuntimeErrorResponse, getProcessFormProjection } from '@/lib/process-automation/form-runtime-service'

interface Params {
  params: Promise<{ workItemId: string }>
}

export async function GET(request: Request, { params }: Params): Promise<NextResponse> {
  try {
    const { workItemId } = await params
    const language = formLanguageSchema.parse(new URL(request.url).searchParams.get('language') ?? 'nl')
    return NextResponse.json({ data: await getProcessFormProjection(workItemId, language) })
  } catch (error) {
    return permissionErrorResponse(error)
      ?? formRuntimeErrorResponse(error)
      ?? NextResponse.json({ code: 'PROCESS_FORM_RUNTIME_INPUT_INVALID' }, { status: 400 })
  }
}
