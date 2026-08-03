import { NextResponse } from 'next/server'
import { talentErrorResponse } from '@/lib/talent/route'
import { getTalentProfileEditor } from '@/lib/talent/service'

export async function GET(_request: Request, { params }: { params: Promise<{ profileId: string }> }) {
  try {
    const { profileId } = await params
    return NextResponse.json({ data: await getTalentProfileEditor(profileId) })
  } catch (error) {
    return talentErrorResponse(error, 'TALENT_PROFILE_EDITOR_READ_FAILED')
  }
}
