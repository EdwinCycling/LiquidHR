import { NextResponse } from 'next/server'
import { clearFocusPreviewCookie } from '@/lib/focus/preview-token'

export async function POST() {
  await clearFocusPreviewCookie()
  return new NextResponse(null, { status: 204 })
}
