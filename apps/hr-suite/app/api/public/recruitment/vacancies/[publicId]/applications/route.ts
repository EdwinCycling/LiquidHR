import { NextResponse } from 'next/server'
import { createPublicIntakeProof, scanAndStorePublicDocument } from '@/lib/recruitment/public-intake-service'
import { publicApplicationInputSchema, submitPublicRecruitmentApplication } from '@/lib/recruitment/application-service'
import { RecruitmentError } from '@/lib/recruitment/errors'
import { validateRecruitmentDocument, createRemoteMalwareScannerAdapter, type RecruitmentDocument } from '@/lib/recruitment/public-security'
import { getPublicVacancy } from '@/lib/recruitment/public-repository'

export async function POST(request: Request, { params }: { params: Promise<{ publicId: string }> }): Promise<NextResponse> {
  try {
    const { publicId } = await params
    const payload = await readPayload(request)
    const parsed = publicApplicationInputSchema.safeParse(payload.input)
    if (!parsed.success) return NextResponse.json({ code: 'RECRUITMENT_PUBLIC_INPUT_INVALID' }, { status: 422 })
    const vacancy = await getPublicVacancy(publicId, payload.slug)
    if (!vacancy) return NextResponse.json({ code: 'RECRUITMENT_PUBLIC_VACANCY_NOT_FOUND' }, { status: 404 })
    const config = typeof vacancy.content.formConfig === 'object' && vacancy.content.formConfig !== null ? vacancy.content.formConfig as Record<string, unknown> : {}
    const mode = (value: unknown): 'HIDDEN' | 'OPTIONAL' | 'REQUIRED' => value === 'HIDDEN' || value === 'REQUIRED' ? value : 'OPTIONAL'
    if ((mode(config.phone) === 'REQUIRED' && !parsed.data.phone.trim()) || (mode(config.motivation) === 'REQUIRED' && !parsed.data.motivation.trim()) || (mode(config.cv) === 'REQUIRED' && !payload.file) || (mode(config.cv) === 'HIDDEN' && payload.file)) return NextResponse.json({ code: 'RECRUITMENT_PUBLIC_INPUT_INVALID' }, { status: 422 })
    const document = payload.file
    if (document) {
      const validation = validateRecruitmentDocument(document)
      if (!validation.ok) return NextResponse.json({ code: validation.code }, { status: 422 })
      const scan = await createRemoteMalwareScannerAdapter().scan(document)
      if (scan.status === 'UNAVAILABLE') return NextResponse.json({ code: 'RECRUITMENT_MALWARE_SCANNER_UNAVAILABLE', state: 'SECURITY_BLOCKED' }, { status: 503 })
      if (scan.status === 'REJECTED') return NextResponse.json({ code: 'RECRUITMENT_DOCUMENT_REJECTED', state: 'SECURITY_BLOCKED' }, { status: 422 })
    }
    const address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? 'unknown'
    const proof = await createPublicIntakeProof({ publicationId: publicId, challengeToken: parsed.data.challengeToken, networkAddress: address, formFingerprint: `${parsed.data.idempotencyKey}:${parsed.data.email}` })
    const applicationId = await submitPublicRecruitmentApplication(publicId, payload.slug, parsed.data, proof)
    if (document) await scanAndStorePublicDocument(applicationId, document)
    return NextResponse.json({ data: { accepted: true }, state: 'CONFIRMED' }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof RecruitmentError) return NextResponse.json({ code: error.code, state: error.code.startsWith('RECRUITMENT_BOT_') || error.code.startsWith('RECRUITMENT_MALWARE_') ? 'SECURITY_BLOCKED' : undefined }, { status: error.status })
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
