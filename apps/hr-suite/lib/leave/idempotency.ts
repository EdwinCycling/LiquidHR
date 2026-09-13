export async function createLeaveRequestIdempotencyKey(parts: readonly string[]): Promise<string> {
  const payload = parts.join('\u001f')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload))
  const hexadecimal = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `leave:${hexadecimal}`
}
