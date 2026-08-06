import { NextResponse } from 'next/server'
import { getActiveHrGroupBrandingLogo } from '@/lib/settings/branding-service'

export async function GET() {
    const logo = await getActiveHrGroupBrandingLogo()
  if (!logo) return new NextResponse(null, { status: 404 })
  return new NextResponse(logo.body, {
    headers: {
      'Cache-Control': 'private, max-age=300',
      'Content-Type': logo.contentType,
    },
  })
}
