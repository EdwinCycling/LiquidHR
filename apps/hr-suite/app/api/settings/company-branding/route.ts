import { NextResponse } from 'next/server'
import { AuthorizationError, permissionErrorResponse } from '@/lib/auth/permissions'
import { saveAdministrationBranding } from '@/lib/settings/branding-service'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const logoValue = formData.get('logo')
    const logo = logoValue instanceof File && logoValue.size > 0 ? logoValue : null
    const branding = await saveAdministrationBranding({
      primaryColor: String(formData.get('primaryColor') ?? ''),
      accentColor: String(formData.get('accentColor') ?? ''),
      sidebarColor: String(formData.get('sidebarColor') ?? ''),
      logo,
      removeLogo: formData.get('removeLogo') === 'true',
    })
    return NextResponse.json({ branding })
  } catch (error) {
    const permissionResponse = permissionErrorResponse(error)
    if (permissionResponse) return permissionResponse
    if (error instanceof AuthorizationError) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    const code = error instanceof Error ? error.message : 'BRANDING_SAVE_FAILED'
    const status = code === 'BRANDING_LOGO_INVALID' || code === 'BRANDING_COLORS_INVALID' ? 400 : code === 'BRANDING_ADMINISTRATION_REQUIRED' ? 400 : 500
    return NextResponse.json({ error: code }, { status })
  }
}
