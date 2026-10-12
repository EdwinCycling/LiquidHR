import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { hasCurrentManagerMcpConsent, managerMcpConsentMetadataPatch } from './manager-consent'

/** Update and read back only this OAuth client's trusted Manager-consent marker. */
export async function setManagerMcpConsentMarker(
  userId: string,
  clientId: unknown,
  approved: boolean,
): Promise<boolean> {
  const appMetadata = managerMcpConsentMetadataPatch(clientId, approved)
  if (!appMetadata) return false

  try {
    const admin = createAdminClient()
    // GoTrue's User.UpdateAppMetaData merges top-level keys; null removes only this marker key.
    const { data, error } = await admin.auth.admin.updateUserById(userId, { app_metadata: appMetadata })
    if (error || data.user?.id !== userId) return false
    return approved
      ? hasCurrentManagerMcpConsent(data.user.app_metadata, clientId)
      : !hasCurrentManagerMcpConsent(data.user.app_metadata, clientId)
  } catch {
    return false
  }
}
