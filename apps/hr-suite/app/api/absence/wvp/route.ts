import { NextResponse } from 'next/server'
import { executeWvpCommand, listWvpCases, WvpError, wvpErrorStatus } from '@/lib/absence/wvp/service'

export async function GET(request: Request) {
  try { return NextResponse.json({ data: await listWvpCases(new URL(request.url).searchParams.get('caseId') ?? undefined) }) }
  catch (error) { return failure(error) }
}
export async function POST(request: Request) {
  try { return NextResponse.json({ data: await executeWvpCommand(await request.json()) }) }
  catch (error) { return failure(error) }
}
function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof WvpError ? error.code : 'WVP_OPERATION_FAILED' }, { status: wvpErrorStatus(error) })
}
