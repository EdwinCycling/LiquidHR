import { NextResponse } from 'next/server'
import { documentStudioErrorResponse } from '@/lib/document-studio/api'
import { getAssetPreview, retireAsset } from '@/lib/document-studio/service'

type RouteContext = { params: Promise<{ assetId: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  try { const { assetId } = await params; return NextResponse.json({ data: await getAssetPreview(assetId) }) } catch (error) { const response = documentStudioErrorResponse(error); if (response) return response; throw error }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try { const { assetId } = await params; return NextResponse.json({ data: await retireAsset(assetId) }) } catch (error) { const response = documentStudioErrorResponse(error); if (response) return response; throw error }
}
