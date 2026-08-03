import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { productUpdateMutationSchema } from '@/lib/product-updates/schemas'
import { createProductUpdate, listManagedProductUpdates, ProductUpdateServiceError } from '@/lib/product-updates/service'

function errorResponse(error: unknown, fallback: string): NextResponse {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof ProductUpdateServiceError) return NextResponse.json({ error: error.code }, { status: error.status })
  return NextResponse.json({ error: fallback }, { status: 500 })
}

export async function GET(): Promise<NextResponse> {
  try { return NextResponse.json({ data: await listManagedProductUpdates() }) }
  catch (error) { return errorResponse(error, 'PRODUCT_UPDATES_READ_FAILED') }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const parsed = productUpdateMutationSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'PRODUCT_UPDATE_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await createProductUpdate(parsed.data.update, parsed.data.scope) }, { status: 201 })
  } catch (error) { return errorResponse(error, 'PRODUCT_UPDATE_CREATE_FAILED') }
}
