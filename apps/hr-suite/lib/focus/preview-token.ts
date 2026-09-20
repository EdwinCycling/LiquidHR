import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

const PREVIEW_COOKIE = 'liquid-hr-focus-preview'
const PREVIEW_MAX_AGE_SECONDS = 15 * 60

export interface FocusPreviewTokenPayload {
  actorUserId: string
  tenantId: string
  hrGroupId: string
  employeeId: string
  expiresAt: number
}

function previewSecret(): string {
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('FOCUS_PREVIEW_SECRET_MISSING')
  return secret
}

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function sign(value: string): string {
  return createHmac('sha256', previewSecret()).update(value).digest('base64url')
}

export function createFocusPreviewToken(payload: FocusPreviewTokenPayload): string {
  const encodedPayload = encode(JSON.stringify(payload))
  return `${encodedPayload}.${sign(encodedPayload)}`
}

export function readFocusPreviewToken(token: string | null): FocusPreviewTokenPayload | null {
  if (!token) return null
  const [encodedPayload, encodedSignature] = token.split('.')
  if (!encodedPayload || !encodedSignature) return null

  const expectedSignature = Buffer.from(sign(encodedPayload), 'utf8')
  const receivedSignature = Buffer.from(encodedSignature, 'utf8')
  if (expectedSignature.length !== receivedSignature.length || !timingSafeEqual(expectedSignature, receivedSignature)) return null

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Partial<FocusPreviewTokenPayload>
    if (
      typeof payload.actorUserId !== 'string'
      || typeof payload.tenantId !== 'string'
      || typeof payload.hrGroupId !== 'string'
      || typeof payload.employeeId !== 'string'
      || typeof payload.expiresAt !== 'number'
      || payload.expiresAt <= Math.floor(Date.now() / 1000)
    ) return null
    return payload as FocusPreviewTokenPayload
  } catch {
    return null
  }
}

export async function readFocusPreviewCookie(): Promise<FocusPreviewTokenPayload | null> {
  const cookieStore = await cookies()
  return readFocusPreviewToken(cookieStore.get(PREVIEW_COOKIE)?.value ?? null)
}

export async function setFocusPreviewCookie(payload: Omit<FocusPreviewTokenPayload, 'expiresAt'>): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(PREVIEW_COOKIE, createFocusPreviewToken({
    ...payload,
    expiresAt: Math.floor(Date.now() / 1000) + PREVIEW_MAX_AGE_SECONDS,
  }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/focus/preview',
    maxAge: PREVIEW_MAX_AGE_SECONDS,
  })
}

export async function clearFocusPreviewCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(PREVIEW_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/focus/preview',
    maxAge: 0,
  })
}
