import { createClient } from '@/lib/supabase/server'

export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export interface DocumentStudioQueryResult {
  readonly data: unknown
  readonly error: { readonly message: string; readonly code?: string } | null
}

interface DocumentStudioQuery extends PromiseLike<DocumentStudioQueryResult> {
  select(columns?: string): DocumentStudioQuery
  eq(column: string, value: unknown): DocumentStudioQuery
  is(column: string, value: unknown): DocumentStudioQuery
  order(column: string, options?: { ascending?: boolean }): DocumentStudioQuery
  limit(count: number): DocumentStudioQuery
  maybeSingle(): Promise<DocumentStudioQueryResult>
  single(): Promise<DocumentStudioQueryResult>
  insert(values: unknown): DocumentStudioQuery
  update(values: unknown): DocumentStudioQuery
  delete(): DocumentStudioQuery
}

interface DocumentStudioRpcResult {
  readonly data: unknown
  readonly error: { readonly message: string; readonly code?: string } | null
}

export interface DocumentStudioTemplateRow {
  readonly id: string
  readonly tenant_id: string
  readonly hr_group_id: string
  readonly template_key: string
  readonly kind: 'DOCUMENT' | 'COVER' | 'APPENDIX'
  readonly language: 'NL' | 'EN'
  readonly name: string
  readonly description: string | null
  readonly lifecycle: 'ACTIVE' | 'ARCHIVED'
  readonly current_active_version_id: string | null
  readonly created_at: string
  readonly updated_at: string
}

export interface DocumentStudioVersionRow {
  readonly id: string
  readonly tenant_id: string
  readonly hr_group_id: string
  readonly template_id: string
  readonly status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  readonly version_number: number | null
  readonly revision: number
  readonly schema_id: string
  readonly schema_version: number
  readonly document_json: unknown
  readonly content_hash: string
  readonly validation_state: 'VALID' | 'INVALID'
  readonly validation_diagnostics: unknown
  readonly document_type_id: string
  readonly category_code: string
  readonly default_dossier: boolean
  readonly document_profile_id: string | null
  readonly created_at: string
  readonly updated_at: string
  readonly activated_at: string | null
  readonly archived_at: string | null
}

export interface DocumentStudioCompositionRow {
  readonly component_kind: 'COVER' | 'APPENDIX'
  readonly component_template_version_id: string
  readonly sort_order: number
}

export interface DocumentStudioTypeRow {
  readonly id: string
  readonly tenant_id: string
  readonly hr_group_id: string
  readonly code: string
  readonly name: { readonly nl: string; readonly en: string }
  readonly description: { readonly nl?: string; readonly en?: string }
  readonly retention_kind: 'PERMANENT' | 'YEARS'
  readonly retention_years: number | null
  readonly is_active: boolean
}

export interface DocumentStudioProfileRow {
  readonly id: string
  readonly tenant_id: string
  readonly hr_group_id: string
  readonly name: string
  readonly source_administration_id: string
  readonly logo_asset_id: string | null
  readonly is_default: boolean
  readonly is_active: boolean
}

export interface DocumentStudioAdministrationOption {
  readonly id: string
  readonly name: string
}

export interface DocumentStudioTagRow {
  readonly id: string
  readonly name: string
}

export interface DocumentStudioAssetRow {
  readonly id: string
  readonly tenant_id: string
  readonly hr_group_id: string
  readonly status: 'APPROVED' | 'RETIRED'
  readonly original_filename: string
  readonly normalized_mime: 'image/png' | 'image/jpeg'
  readonly byte_size: number
  readonly width: number
  readonly height: number
  readonly pixel_count: number
  readonly sha256: string
  readonly storage_key: string
  readonly created_at: string
  readonly retired_at: string | null
}

function table(client: SupabaseServerClient, relation: string): DocumentStudioQuery {
  return (client.from as unknown as (name: string) => DocumentStudioQuery)(relation)
}

async function read<T>(query: PromiseLike<DocumentStudioQueryResult>): Promise<T> {
  const result = await query
  if (result.error) throw new Error(result.error.message)
  return result.data as T
}

export async function listDocumentStudioTemplates(
  client: SupabaseServerClient,
  tenantId: string,
  hrGroupId: string,
): Promise<DocumentStudioTemplateRow[]> {
  return read<DocumentStudioTemplateRow[]>(table(client, 'document_studio_templates')
    .select('id,tenant_id,hr_group_id,template_key,kind,language,name,description,lifecycle,current_active_version_id,created_at,updated_at')
    .eq('tenant_id', tenantId)
    .eq('hr_group_id', hrGroupId)
    .order('updated_at', { ascending: false })
    .limit(500))
}

export async function getDocumentStudioTemplate(
  client: SupabaseServerClient,
  tenantId: string,
  hrGroupId: string,
  templateId: string,
): Promise<DocumentStudioTemplateRow | null> {
  return read<DocumentStudioTemplateRow | null>(table(client, 'document_studio_templates')
    .select('id,tenant_id,hr_group_id,template_key,kind,language,name,description,lifecycle,current_active_version_id,created_at,updated_at')
    .eq('tenant_id', tenantId)
    .eq('hr_group_id', hrGroupId)
    .eq('id', templateId)
    .maybeSingle())
}

export async function updateDocumentStudioTemplate(
  client: SupabaseServerClient,
  tenantId: string,
  hrGroupId: string,
  templateId: string,
  values: Record<string, unknown>,
): Promise<DocumentStudioTemplateRow> {
  return read<DocumentStudioTemplateRow>(table(client, 'document_studio_templates').update(values)
    .eq('tenant_id', tenantId)
    .eq('hr_group_id', hrGroupId)
    .eq('id', templateId)
    .select('id,tenant_id,hr_group_id,template_key,kind,language,name,description,lifecycle,current_active_version_id,created_at,updated_at')
    .single())
}

export async function listDocumentStudioVersions(
  client: SupabaseServerClient,
  tenantId: string,
  hrGroupId: string,
  templateId: string,
): Promise<DocumentStudioVersionRow[]> {
  return read<DocumentStudioVersionRow[]>(table(client, 'document_studio_template_versions')
    .select('id,tenant_id,hr_group_id,template_id,status,version_number,revision,schema_id,schema_version,document_json,content_hash,validation_state,validation_diagnostics,document_type_id,category_code,default_dossier,document_profile_id,created_at,updated_at,activated_at,archived_at')
    .eq('tenant_id', tenantId)
    .eq('hr_group_id', hrGroupId)
    .eq('template_id', templateId)
    .order('created_at', { ascending: false })
    .limit(200))
}

export async function getDocumentStudioVersion(
  client: SupabaseServerClient,
  tenantId: string,
  hrGroupId: string,
  versionId: string,
): Promise<DocumentStudioVersionRow | null> {
  return read<DocumentStudioVersionRow | null>(table(client, 'document_studio_template_versions')
    .select('id,tenant_id,hr_group_id,template_id,status,version_number,revision,schema_id,schema_version,document_json,content_hash,validation_state,validation_diagnostics,document_type_id,category_code,default_dossier,document_profile_id,created_at,updated_at,activated_at,archived_at')
    .eq('tenant_id', tenantId)
    .eq('hr_group_id', hrGroupId)
    .eq('id', versionId)
    .maybeSingle())
}

export async function listDocumentStudioCompositions(
  client: SupabaseServerClient,
  tenantId: string,
  hrGroupId: string,
  versionId: string,
): Promise<DocumentStudioCompositionRow[]> {
  return read<DocumentStudioCompositionRow[]>(table(client, 'document_studio_template_compositions')
    .select('component_kind,component_template_version_id,sort_order')
    .eq('tenant_id', tenantId)
    .eq('hr_group_id', hrGroupId)
    .eq('document_template_version_id', versionId)
    .order('sort_order', { ascending: true }))
}

export async function listDocumentStudioTypes(
  client: SupabaseServerClient,
  tenantId: string,
  hrGroupId: string,
): Promise<DocumentStudioTypeRow[]> {
  return read<DocumentStudioTypeRow[]>(table(client, 'document_studio_document_types')
    .select('id,tenant_id,hr_group_id,code,name,description,retention_kind,retention_years,is_active')
    .eq('tenant_id', tenantId)
    .eq('hr_group_id', hrGroupId)
    .order('is_active', { ascending: false })
    .order('code', { ascending: true })
    .limit(500))
}

export async function listDocumentStudioProfiles(
  client: SupabaseServerClient,
  tenantId: string,
  hrGroupId: string,
): Promise<DocumentStudioProfileRow[]> {
  return read<DocumentStudioProfileRow[]>(table(client, 'document_studio_document_profiles')
    .select('id,tenant_id,hr_group_id,name,source_administration_id,logo_asset_id,is_default,is_active')
    .eq('tenant_id', tenantId)
    .eq('hr_group_id', hrGroupId)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })
    .limit(500))
}

export async function listDocumentStudioAdministrationOptions(
  client: SupabaseServerClient,
  tenantId: string,
  hrGroupId: string,
): Promise<DocumentStudioAdministrationOption[]> {
  const result = await client.from('administrations')
    .select('id,name')
    .eq('tenant_id', tenantId)
    .eq('hr_group_id', hrGroupId)
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(200)
  if (result.error) throw result.error
  return result.data.map((row) => ({ id: row.id, name: row.name }))
}

export async function listDocumentStudioAssets(
  client: SupabaseServerClient,
  tenantId: string,
  hrGroupId: string,
): Promise<DocumentStudioAssetRow[]> {
  return read<DocumentStudioAssetRow[]>(table(client, 'document_studio_assets')
    .select('id,tenant_id,hr_group_id,status,original_filename,normalized_mime,byte_size,width,height,pixel_count,sha256,storage_key,created_at,retired_at')
    .eq('tenant_id', tenantId)
    .eq('hr_group_id', hrGroupId)
    .eq('status', 'APPROVED')
    .order('created_at', { ascending: false })
    .limit(500))
}

export async function listDocumentStudioTags(client: SupabaseServerClient, tenantId: string): Promise<DocumentStudioTagRow[]> {
  const result = await client.from('star_performer_tags').select('id,name').eq('tenant_id', tenantId).eq('is_active', true).order('name', { ascending: true }).limit(500)
  if (result.error) throw result.error
  return result.data
}

export async function listDocumentStudioTemplateTagIds(
  client: SupabaseServerClient,
  tenantId: string,
  hrGroupId: string,
  templateId: string,
): Promise<string[]> {
  return read<string[]>(table(client, 'document_studio_template_tags').select('tag_id').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).eq('template_id', templateId).limit(50))
}

export async function callDocumentStudioRpc(
  client: SupabaseServerClient,
  functionName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const rpc = client.rpc as unknown as (name: string, parameters: Record<string, unknown>) => Promise<DocumentStudioRpcResult>
  return read<unknown>(rpc(functionName, args))
}

export async function insertDocumentStudioType(
  client: SupabaseServerClient,
  values: Record<string, unknown>,
): Promise<DocumentStudioTypeRow> {
  return read<DocumentStudioTypeRow>(table(client, 'document_studio_document_types').insert(values).select('id,tenant_id,hr_group_id,code,name,description,retention_kind,retention_years,is_active').single())
}

export async function updateDocumentStudioType(
  client: SupabaseServerClient,
  id: string,
  tenantId: string,
  hrGroupId: string,
  values: Record<string, unknown>,
): Promise<DocumentStudioTypeRow> {
  return read<DocumentStudioTypeRow>(table(client, 'document_studio_document_types').update(values).eq('id', id).eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).select('id,tenant_id,hr_group_id,code,name,description,retention_kind,retention_years,is_active').single())
}

export async function insertDocumentStudioProfile(
  client: SupabaseServerClient,
  values: Record<string, unknown>,
): Promise<DocumentStudioProfileRow> {
  return read<DocumentStudioProfileRow>(table(client, 'document_studio_document_profiles').insert(values).select('id,tenant_id,hr_group_id,name,source_administration_id,logo_asset_id,is_default,is_active').single())
}

export async function updateDocumentStudioProfile(
  client: SupabaseServerClient,
  id: string,
  tenantId: string,
  hrGroupId: string,
  values: Record<string, unknown>,
): Promise<DocumentStudioProfileRow> {
  return read<DocumentStudioProfileRow>(table(client, 'document_studio_document_profiles').update(values).eq('id', id).eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).select('id,tenant_id,hr_group_id,name,source_administration_id,logo_asset_id,is_default,is_active').single())
}

export async function deleteDocumentStudioAssetRow(
  client: SupabaseServerClient,
  tenantId: string,
  hrGroupId: string,
  assetId: string,
): Promise<void> {
  await read<unknown>(table(client, 'document_studio_assets').delete().eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).eq('id', assetId))
}
