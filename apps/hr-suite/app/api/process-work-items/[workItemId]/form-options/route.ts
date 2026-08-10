import { NextResponse } from 'next/server'
import { formLanguageSchema, formRuntimeErrorResponse } from '@/lib/process-automation/form-runtime-service'
import { getFormReferenceOptions } from '@/lib/process-automation/form-reference-options-service'
import { permissionErrorResponse } from '@/lib/auth/permissions'

interface Params {
  readonly params: Promise<{ workItemId: string }>
}

export async function GET(request: Request, { params }: Params): Promise<NextResponse> {
  try {
    const { workItemId } = await params
    const searchParams = new URL(request.url).searchParams
    const fieldKey = searchParams.get('fieldKey')?.trim() ?? ''
    const language = formLanguageSchema.parse(searchParams.get('language') ?? 'nl')
    const options = await getFormReferenceOptions(workItemId, fieldKey, language, searchParams.get('q') ?? '')
    return NextResponse.json({ data: { options } })
  } catch (error) {
    return permissionErrorResponse(error)
      ?? formRuntimeErrorResponse(error)
      ?? NextResponse.json({ code: 'PROCESS_FORM_RUNTIME_OPERATION_FAILED' }, { status: 500 })
  }
}
