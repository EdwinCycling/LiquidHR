import { NextResponse } from 'next/server'
import { parseStartPagePreferencesPatch, saveStartPagePreferences, startPagePreferencesJson } from '@/lib/preferences/start-page'

export async function PATCH(request: Request) {
  const body: unknown = await request.json().catch(() => null)
  const patch = parseStartPagePreferencesPatch(body)
  if (!patch.viewMode && !patch.layout) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
  const saved = await saveStartPagePreferences(patch)
  if (!saved) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  return NextResponse.json({ data: startPagePreferencesJson(saved) })
}
