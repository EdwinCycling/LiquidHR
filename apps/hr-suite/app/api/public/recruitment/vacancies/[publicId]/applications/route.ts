import { NextResponse } from 'next/server'
import { BoundedRequestBodyError, readBoundedRequest } from '@/lib/http/bounded-request-body'
import { getTrustedClientIdentity } from '@/lib/security/trusted-client-identity'
import { createPublicIntakeProof, scanPublicDocument, storePublicDocument } from '@/lib/recruitment/public-intake-service'
import { publicApplicationInputSchema, submitPublicRecruitmentApplication } from '@/lib/recruitment/application-service'
import { RecruitmentError } from '@/lib/recruitment/errors'
import { PUBLIC_RECRUITMENT_DOCUMENT_MAX_BYTES, validateRecruitmentDocument, type RecruitmentDocument } from '@/lib/recruitment/public-security'
import { getPublicVacancy } from '@/lib/recruitment/public-repository'

export async function POST(request: Request, { params }: { params: Promise<{ publicId: string }> }): Promise<NextResponse> {
  try {
    const { publicId } = await params
    const boundedRequest = await readBoundedRequest(request)
    const payload = await readPayload(boundedRequest)
    const parsed = publicApplicationInputSchema.safeParse(payload.input)
    if (!parsed.success) return NextResponse.json({ code: 'RECRUITMENT_PUBLIC_INPUT_INVALID' }, { status: 422 })
    const document = payload.file
    if (document) {
      const validation = validateRecruitmentDocument(document, { maxBytes: PUBLIC_RECRUITMENT_DOCUMENT_MAX_BYTES })
      if (!validation.ok) return NextResponse.json({ code: validation.code }, { status: 422 })
    }
    const vacancy = await getPublicVacancy(publicId, payload.slug)
    if (!vacancy) return NextResponse.json({ code: 'RECRUITMENT_PUBLIC_VACANCY_NOT_FOUND' }, { status: 404 })
    const config = typeof vacancy.content.formConfig === 'object' && vacancy.content.formConfig !== null ? vacancy.content.formConfig as Record<string, unknown> : {}
    const mode = (value: unknown): 'HIDDEN' | 'OPTIONAL' | 'REQUIRED' => value === 'HIDDEN' || value === 'REQUIRED' ? value : 'OPTIONAL'
    if ((mode(config.phone) === 'REQUIRED' && !parsed.data.phone.trim()) || (mode(config.motivation) === 'REQUIRED' && !parsed.data.motivation.trim()) || (mode(config.cv) === 'REQUIRED' && !payload.file) || (mode(config.cv) === 'HIDDEN' && payload.file)) return NextResponse.json({ code: 'RECRUITMENT_PUBLIC_INPUT_INVALID' }, { status: 422 })
    const identity = getTrustedClientIdentity(request)
    if (!identity.ok) throw new RecruitmentError('RECRUITMENT_PUBLIC_SECURITY_UNAVAILABLE', 503)
    const claim = await createPublicIntakeProof({ publicationId: publicId, challengeToken: parsed.data.challengeToken, trustedClientIdentity: identity.identity })
    const scan = document ? await scanPublicDocument(document) : null
    const applicationId = await submitPublicRecruitmentApplication(publicId, payload.slug, parsed.data, claim.proof, claim.bucketKeyHash)
    if (document && scan) await storePublicDocument(applicationId, document, scan)
    return NextResponse.json({ data: { accepted: true }, state: 'CONFIRMED' }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof BoundedRequestBodyError) return NextResponse.json({ code: error.code }, { status: error.status, headers: { 'Cache-Control': 'no-store' } })
    if (error instanceof RecruitmentError) {
      const headers = new Headers({ 'Cache-Control': 'no-store' })
      if (error.status === 429 && Number.isInteger(error.retryAfterSeconds)) headers.set('Retry-After', String(error.retryAfterSeconds))
      return NextResponse.json({ code: error.code, state: error.code.startsWith('RECRUITMENT_BOT_') || error.code.startsWith('RECRUITMENT_MALWARE_') ? 'SECURITY_BLOCKED' : undefined }, { status: error.status, headers })
    }
    throw error
  }
}

async function readPayload(request: Request): Promise<{ readonly input: unknown; readonly slug: string; readonly file: RecruitmentDocument | null }> {
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData()
    const fileValue = form.get('cv')
    const file = fileValue instanceof File && fileValue.size > 0 ? {
      bytes: new Uint8Array(await fileValue.arrayBuffer()), mimeType: fileValue.type, size: fileValue.size, fileName: fileValue.name,
    } : null
    return {
      slug: String(form.get('slug') ?? ''),
      file,
      input: {
        firstName: String(form.get('firstName') ?? ''), lastName: String(form.get('lastName') ?? ''), email: String(form.get('email') ?? ''),
        phone: String(form.get('phone') ?? ''), motivation: String(form.get('motivation') ?? ''), answers: [], challengeToken: String(form.get('challengeToken') ?? ''),
        honeypot: String(form.get('website') ?? ''), renderedAt: String(form.get('renderedAt') ?? ''), idempotencyKey: String(form.get('idempotencyKey') ?? crypto.randomUUID()),
      },
    }
  }
  const body: unknown = await request.json().catch(() => null)
  if (typeof body !== 'object' || body === null) return { input: null, slug: '', file: null }
  const record = body as Record<string, unknown>
  return { input: record.input ?? body, slug: typeof record.slug === 'string' ? record.slug : '', file: null }
}
