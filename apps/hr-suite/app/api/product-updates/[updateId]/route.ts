import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { productUpdateSchema } from '@/lib/product-updates/schemas'
import { deleteProductUpdate, ProductUpdateServiceError, updateProductUpdate } from '@/lib/product-updates/service'

type RouteContext = { params: Promise<{ updateId: string }> }

function errorResponse(error: unknown, fallback: string): NextResponse {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof ProductUpdateServiceError) return NextResponse.json({ error: error.code }, { status: error.status })
  return NextResponse.json({ error: fallback }, { status: 500 })
}

export async function PATCH(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const body = await request.json() as { update?: unknown }
    const parsed = productUpdateSchema.safeParse(body.update)
    if (!parsed.success) return NextResponse.json({ error: 'PRODUCT_UPDATE_INPUT_INVALID' }, { status: 400 })
    const { updateId } = await params
    return NextResponse.json({ data: await updateProductUpdate(updateId, parsed.data) })
  } catch (error) { return errorResponse(error, 'PRODUCT_UPDATE_UPDATE_FAILED') }
}

export async function DELETE(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try { await deleteProductUpdate((await params).updateId); return new NextResponse(null, { status: 204 }) }
  catch (error) { return errorResponse(error, 'PRODUCT_UPDATE_DELETE_FAILED') }
}
