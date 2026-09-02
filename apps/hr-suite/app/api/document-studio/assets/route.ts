import { NextResponse } from 'next/server'
import { documentStudioErrorResponse } from '@/lib/document-studio/api'
import { createStructuralAsset, listAssets } from '@/lib/document-studio/service'

export async function GET() {
  try { return NextResponse.json({ data: await listAssets() }) } catch (error) { const response = documentStudioErrorResponse(error); if (response) return response; throw error }
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get('content-length') ?? '0')
    if (Number.isFinite(contentLength) && contentLength > 6 * 1024 * 1024) {
      return NextResponse.json({ code: 'DOCUMENT_ASSET_INPUT_TOO_LARGE' }, { status: 413 })
    }
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return NextResponse.json({ code: 'DOCUMENT_ASSET_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await createStructuralAsset(file) }, { status: 201 })
  } catch (error) { const response = documentStudioErrorResponse(error); if (response) return response; throw error }
}
