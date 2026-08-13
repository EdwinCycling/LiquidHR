export type RecruitmentDocument = {
  readonly bytes: Uint8Array
  readonly mimeType: string
  readonly size: number
  readonly fileName: string
}

export type BotChallengeResult = { readonly ok: true } | { readonly ok: false; readonly code: string }
export type MalwareScanResult =
  | { readonly status: 'CLEAN'; readonly reference: string }
  | { readonly status: 'REJECTED'; readonly reference?: string }
  | { readonly status: 'UNAVAILABLE' }

export interface BotChallengeAdapter {
  verify(token: string): Promise<BotChallengeResult>
}

export interface MalwareScannerAdapter {
  scan(document: RecruitmentDocument): Promise<MalwareScanResult>
}

type FetchLike = typeof fetch

export function createTurnstileBotChallengeAdapter(
  options: { readonly secret?: string; readonly fetcher?: FetchLike } = {},
): BotChallengeAdapter {
  const secret = options.secret ?? process.env.TURNSTILE_SECRET_KEY
  const fetcher = options.fetcher ?? fetch
  return {
    async verify(token) {
      if (!secret) return { ok: false, code: 'RECRUITMENT_BOT_CHALLENGE_UNAVAILABLE' }
      try {
        const body = new URLSearchParams({ secret, response: token })
        const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body })
        if (!response.ok) return { ok: false, code: 'RECRUITMENT_BOT_CHALLENGE_UNAVAILABLE' }
        const payload: unknown = await response.json()
        return typeof payload === 'object' && payload !== null && 'success' in payload && payload.success === true
          ? { ok: true }
          : { ok: false, code: 'RECRUITMENT_BOT_CHALLENGE_INVALID' }
      } catch {
        return { ok: false, code: 'RECRUITMENT_BOT_CHALLENGE_UNAVAILABLE' }
      }
    },
  }
}

export function createRemoteMalwareScannerAdapter(
  options: { readonly url?: string; readonly apiKey?: string; readonly fetcher?: FetchLike } = {},
): MalwareScannerAdapter {
  const url = options.url ?? process.env.RECRUITMENT_MALWARE_SCAN_URL
  const apiKey = options.apiKey ?? process.env.RECRUITMENT_MALWARE_SCAN_API_KEY
  const fetcher = options.fetcher ?? fetch
  return {
    async scan(document) {
      if (!url || !apiKey) return { status: 'UNAVAILABLE' }
      try {
        const body = new Uint8Array(document.bytes).buffer
        const response = await fetcher(url, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type': document.mimeType,
            'x-recruitment-filename': encodeURIComponent(document.fileName),
          },
          body,
          cache: 'no-store',
        })
        if (!response.ok) return response.status === 422 ? { status: 'REJECTED' } : { status: 'UNAVAILABLE' }
        const payload: unknown = await response.json()
        if (typeof payload !== 'object' || payload === null || !('status' in payload)) return { status: 'UNAVAILABLE' }
        const reference = 'reference' in payload && typeof payload.reference === 'string' ? payload.reference : undefined
        if (payload.status === 'CLEAN' && reference) return { status: 'CLEAN', reference }
        if (payload.status === 'REJECTED') return { status: 'REJECTED', ...(reference ? { reference } : {}) }
        return { status: 'UNAVAILABLE' }
      } catch {
        return { status: 'UNAVAILABLE' }
      }
    },
  }
}

export function validateRecruitmentDocument(document: RecruitmentDocument):
  | { readonly ok: true; readonly detectedType: 'PDF' | 'DOCX' }
  | { readonly ok: false; readonly code: string } {
  if (document.size !== document.bytes.byteLength || document.size < 1 || document.size > 10 * 1024 * 1024) {
    return { ok: false, code: 'RECRUITMENT_DOCUMENT_SIZE_INVALID' }
  }
  const pdf = document.mimeType === 'application/pdf'
    && document.fileName.toLowerCase().endsWith('.pdf')
    && document.bytes.length >= 4
    && document.bytes[0] === 0x25 && document.bytes[1] === 0x50 && document.bytes[2] === 0x44 && document.bytes[3] === 0x46
  if (pdf) return { ok: true, detectedType: 'PDF' }
  const docx = document.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    && document.fileName.toLowerCase().endsWith('.docx')
    && document.bytes.length >= 4
    && document.bytes[0] === 0x50 && document.bytes[1] === 0x4b && document.bytes[2] === 0x03 && document.bytes[3] === 0x04
  if (docx) return { ok: true, detectedType: 'DOCX' }
  return { ok: false, code: 'RECRUITMENT_DOCUMENT_SIGNATURE_INVALID' }
}

export async function createPublicIntakeKey(
  input: { readonly networkAddress: string; readonly formFingerprint: string },
  pepper: string,
): Promise<string> {
  if (pepper.length < 8) throw new Error('RECRUITMENT_RATE_LIMIT_PEPPER_INVALID')
  const data = new TextEncoder().encode(`${pepper}\u0000${input.networkAddress}\u0000${input.formFingerprint}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function evaluatePublicUpload(
  input: { readonly token: string; readonly document: RecruitmentDocument },
  dependencies: { readonly bot: BotChallengeAdapter; readonly scanner: MalwareScannerAdapter },
): Promise<
  | { readonly ok: true; readonly scanReference: string; readonly detectedType: 'PDF' | 'DOCX' }
  | { readonly ok: false; readonly code: string }
> {
  const challenge = await dependencies.bot.verify(input.token)
  if (!challenge.ok) return challenge
  const validation = validateRecruitmentDocument(input.document)
  if (!validation.ok) return validation
  const scan = await dependencies.scanner.scan(input.document)
  if (scan.status === 'UNAVAILABLE') return { ok: false, code: 'RECRUITMENT_MALWARE_SCANNER_UNAVAILABLE' }
  if (scan.status === 'REJECTED') return { ok: false, code: 'RECRUITMENT_DOCUMENT_REJECTED' }
  return { ok: true, scanReference: scan.reference, detectedType: validation.detectedType }
}
