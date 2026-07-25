import { NextResponse } from 'next/server'
import { permissionErrorResponse, requirePermission } from '@/lib/auth/permissions'
import { lookupDutchAddress } from '@/lib/address/address-suggestions'

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requirePermission('employee:read')
    const url = new URL(request.url)
    const country = (url.searchParams.get('country') ?? '').toUpperCase()
    const postalCode = (url.searchParams.get('postcode') ?? '').trim()
    const houseNumber = (url.searchParams.get('houseNumber') ?? '').trim()
    if (country !== 'NL' || !/^\d{4}\s?[A-Za-z]{2}$/.test(postalCode) || !/^\d+$/.test(houseNumber)) {
      return NextResponse.json({ error: 'ADDRESS_LOOKUP_INPUT_INVALID' }, { status: 400 })
    }
    const suggestions = await lookupDutchAddress(postalCode, houseNumber)
    return NextResponse.json({ data: suggestions }, { headers: { 'cache-control': 'private, max-age=60' } })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    return NextResponse.json({ error: 'ADDRESS_LOOKUP_UNAVAILABLE' }, { status: 503 })
  }
}
