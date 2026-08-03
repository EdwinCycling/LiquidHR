import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { markProductUpdatesSeen, ProductUpdateServiceError } from '@/lib/product-updates/service'

export async function POST(): Promise<NextResponse> {
  try { await markProductUpdatesSeen(); return NextResponse.json({ ok: true }) }
  catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof ProductUpdateServiceError) return NextResponse.json({ error: error.code }, { status: error.status })
    return NextResponse.json({ error: 'PRODUCT_UPDATES_SEEN_FAILED' }, { status: 500 })
  }
}
