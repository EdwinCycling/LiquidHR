import 'server-only'

import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { redirect } from 'next/navigation'
import { ANALYSIS_PERMISSION } from './analysis-contract'

export async function requireAnalysisPageAccess(): Promise<void> {
  try {
    await requirePermission(ANALYSIS_PERMISSION)
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }
}
