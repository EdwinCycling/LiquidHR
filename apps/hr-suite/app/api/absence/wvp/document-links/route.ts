import { NextResponse } from 'next/server'
import {
  addWvpDocumentLink,
  listWvpDocumentLinks,
  removeWvpDocumentLink,
  WvpError,
  wvpErrorStatus,
} from '@/lib/absence/wvp/service'

export async function GET(request: Request) {
  try {
    const caseId = new URL(request.url).searchParams.get('caseId')
    if (!caseId) throw new WvpError('WVP_INVALID_INPUT', 400)
    return NextResponse.json({ data: await listWvpDocumentLinks(caseId) })
  } catch (error) { return failure(error) }
}

export async function POST(request: Request) {
  try { return NextResponse.json({ data: await addWvpDocumentLink(await request.json()) }) }
  catch (error) { return failure(error) }
}

export async function DELETE(request: Request) {
  try { return NextResponse.json({ data: await removeWvpDocumentLink(await request.json()) }) }
  catch (error) { return failure(error) }
}

function failure(error: unknown) {
  return NextResponse.json(
    { error: error instanceof WvpError ? error.code : 'WVP_OPERATION_FAILED' },
    { status: wvpErrorStatus(error) },
  )
}
