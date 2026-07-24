import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { anniversaryRuleSchema, createAnniversaryRule, deleteAnniversaryRule } from '@/lib/settings/anniversary-rules'

export async function POST(request: Request) {
  try { await createAnniversaryRule(anniversaryRuleSchema.parse(await request.json())); return NextResponse.json({ data: true }, { status: 201 }) }
  catch (error) { const permission = permissionErrorResponse(error); if (permission) return permission; return NextResponse.json({ error: error instanceof Error ? error.message : 'ANNIVERSARY_RULE_CREATE_FAILED' }, { status: 400 }) }
}

export async function DELETE(request: Request) {
  try { const { id } = await request.json() as { id?: string }; if (!id) return NextResponse.json({ error: 'ANNIVERSARY_RULE_ID_REQUIRED' }, { status: 400 }); await deleteAnniversaryRule(id); return NextResponse.json({ data: true }) }
  catch (error) { const permission = permissionErrorResponse(error); if (permission) return permission; return NextResponse.json({ error: 'ANNIVERSARY_RULE_DELETE_FAILED' }, { status: 500 }) }
}
