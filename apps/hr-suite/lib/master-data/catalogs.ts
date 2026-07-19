import type { Database } from '@scope/db'
import { requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

export type DocumentCategory = Pick<Database['public']['Tables']['document_categories']['Row'], 'id' | 'code' | 'name' | 'description' | 'is_active'>
export type RelationType = Pick<Database['public']['Tables']['relation_types']['Row'], 'id' | 'code' | 'name_nl' | 'name_en' | 'is_active'>

export async function listDocumentCategories() {
  const context = await requirePermission('document:read')
  if (!context.administrationId) return [] satisfies DocumentCategory[]
  const supabase = await createClient()
  const { data, error } = await supabase.from('document_categories').select('id, code, name, description, is_active').eq('tenant_id', context.tenantId).eq('administration_id', context.administrationId).order('code').limit(300)
  if (error) throw new Error('DOCUMENT_CATEGORY_READ_FAILED')
  return data satisfies DocumentCategory[]
}

export async function listRelationTypes() {
  const context = await requirePermission('employee:read')
  const supabase = await createClient()
  const { data, error } = await supabase.from('relation_types').select('id, code, name_nl, name_en, is_active').eq('tenant_id', context.tenantId).order('name_nl').limit(100)
  if (error) throw new Error('RELATION_TYPE_READ_FAILED')
  return data satisfies RelationType[]
}
