import { NextResponse } from 'next/server'

export async function POST(): Promise<NextResponse> {
  const response = NextResponse.json({ error: 'LOCAL_PERSONA_SWITCH_REQUIRED' }, { status: 404 })
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  return response
}
