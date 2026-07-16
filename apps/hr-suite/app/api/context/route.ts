import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { loadActiveContext } from '@/lib/context/server-context'

export async function GET() {
  try {
    const context = await loadActiveContext()
    return NextResponse.json({ data: context })
  } catch (error) {
    const response = permissionErrorResponse(error)
    if (response) return response
    throw error
  }
}
