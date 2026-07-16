import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import {
  archiveCustomFieldDefinition,
  CustomFieldServiceError,
  updateCustomFieldDefinition,
} from '@/lib/custom-fields/service'
import { customFieldDefinitionUpdateSchema } from '@/lib/custom-fields/schemas'

function handleError(error: unknown): NextResponse {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof CustomFieldServiceError) return NextResponse.json({ error: error.code }, { status: error.status })
  return NextResponse.json({ error: 'CUSTOM_FIELD_FAILED' }, { status: 500 })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ definitionId: string }> },
): Promise<NextResponse> {
  try {
    const parsed = customFieldDefinitionUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'CUSTOM_FIELD_INPUT_INVALID' }, { status: 400 })
    const { definitionId } = await params
    return NextResponse.json({ data: await updateCustomFieldDefinition(definitionId, parsed.data) })
  } catch (error) {
    return handleError(error)
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ definitionId: string }> },
): Promise<NextResponse> {
  try {
    const { definitionId } = await params
    await archiveCustomFieldDefinition(definitionId)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return handleError(error)
  }
}
