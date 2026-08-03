import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { productUpdateSurfaceSeenSchema } from '@/lib/product-updates/schemas'
import { markProductUpdateSurfaceSeen, ProductUpdateServiceError } from '@/lib/product-updates/service'

function errorResponse(error: unknown): NextResponse {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof ProductUpdateServiceError) return NextResponse.json({ error: error.code }, { status: error.status })
  return NextResponse.json({ error: 'PRODUCT_UPDATE_SURFACE_SEEN_FAILED' }, { status: 500 })
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const parsed = productUpdateSurfaceSeenSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'PRODUCT_UPDATE_INPUT_INVALID' }, { status: 400 })
    await markProductUpdateSurfaceSeen(parsed.data)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return errorResponse(error)
  }
}
