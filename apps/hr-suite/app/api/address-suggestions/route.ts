import { NextResponse } from 'next/server'
import { permissionErrorResponse, requirePermission } from '@/lib/auth/permissions'
import { isCountryCode } from '@/lib/address/address-config'
import { AddressProviderError, searchAddressSuggestions } from '@/lib/address/address-suggestions'

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requirePermission('employee:read')
    const url = new URL(request.url)
    const country = (url.searchParams.get('country') ?? '').toUpperCase()
    const query = (url.searchParams.get('q') ?? '').trim()
    if (!isCountryCode(country) || query.length < 3 || query.length > 160) {
      return NextResponse.json({ error: 'ADDRESS_SEARCH_INPUT_INVALID' }, { status: 400 })
    }
    const suggestions = await searchAddressSuggestions(country, query)
    return NextResponse.json({ data: suggestions }, { headers: { 'cache-control': 'private, max-age=30' } })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof AddressProviderError || error instanceof Error) {
      return NextResponse.json({ error: 'ADDRESS_SEARCH_UNAVAILABLE' }, { status: 503 })
    }
    return NextResponse.json({ error: 'ADDRESS_SEARCH_UNAVAILABLE' }, { status: 503 })
  }
}
