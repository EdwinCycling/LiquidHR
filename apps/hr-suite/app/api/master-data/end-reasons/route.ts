import { NextResponse } from 'next/server'
import { EndReasonError, listEndReasons } from '@/lib/master-data/end-reasons'
export async function GET() { try { return NextResponse.json({ data: await listEndReasons() }) } catch (error) { return NextResponse.json({ error: error instanceof EndReasonError ? error.code : 'END_REASON_READ_FAILED' }, { status: error instanceof EndReasonError ? error.status : 500 }) } }
