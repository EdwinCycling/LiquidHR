import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/** Reuses an identical, scope-filtered pension catalog read for one server render. */
export const readPayrollSourcePensionVersionTiers = cache(async (
  tenantId: string,
  hrGroupId: string,
  administrationId: string,
  pensionVersionIdsKey: string,
) => {
  const pensionVersionIds = pensionVersionIdsKey.split(',').filter(Boolean)
  const supabase = await createClient()
  return await supabase.from('pension_arrangement_version_tiers')
    .select('id, tenant_id, hr_group_id, administration_id, pension_arrangement_id, pension_arrangement_version_id, min_age, max_age, total_rate, created_at')
    .eq('tenant_id', tenantId)
    .eq('hr_group_id', hrGroupId)
    .eq('administration_id', administrationId)
    .in('pension_arrangement_version_id', pensionVersionIds)
    .order('min_age')
})
