import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import {
  createCustomFieldDefinition,
  CustomFieldServiceError,
  listCustomFieldDefinitions,
} from '@/lib/custom-fields/service'
import { customFieldDefinitionSchema } from '@/lib/custom-fields/schemas'

function handleError(error: unknown): NextResponse {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof CustomFieldServiceError) {
    return NextResponse.json({ error: error.code }, { status: error.status })
  }
  return NextResponse.json({ error: 'CUSTOM_FIELDS_FAILED' }, { status: 500 })
}

export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json({ data: await listCustomFieldDefinitions() })
  } catch (error) {
    return handleError(error)
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const parsed = customFieldDefinitionSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'CUSTOM_FIELD_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await createCustomFieldDefinition(parsed.data) }, { status: 201 })
  } catch (error) {
    return handleError(error)
  }
}
