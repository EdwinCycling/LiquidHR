import { describe, expect, it } from 'vitest'
import { callDocumentStudioRpc, mapDocumentStudioTemplateTagRows, toDocumentStudioAssetDto } from './repository'
import type { DocumentStudioAssetInternalRow } from './repository'

describe('Document Studio repository DTO mapping', () => {
  it('maps Supabase tag rows to stable string ids', () => {
    expect(mapDocumentStudioTemplateTagRows([{ tag_id: 'tag-a' }, { tag_id: 'tag-b' }])).toEqual(['tag-a', 'tag-b'])
  })

  it('removes the raw storage path from the client asset DTO', () => {
    const row: DocumentStudioAssetInternalRow = { id: 'asset', tenant_id: 'tenant', hr_group_id: 'group', status: 'APPROVED', original_filename: 'logo.png', normalized_mime: 'image/png', byte_size: 12, width: 2, height: 2, pixel_count: 4, sha256: 'a'.repeat(64), storage_key: 'tenant/group/asset/normalized.png', created_at: '2026-09-03T00:00:00.000Z', retired_at: null }
    expect(toDocumentStudioAssetDto(row)).not.toHaveProperty('storage_key')
  })

  it('preserves the Supabase client receiver when invoking Document Studio RPCs', async () => {
    const client = {
      rest: { rpc: (name: string, parameters: Record<string, unknown>) => ({ name, parameters }) },
      rpc(this: { rest: { rpc: (name: string, parameters: Record<string, unknown>) => unknown } }, name: string, parameters: Record<string, unknown>) {
        return Promise.resolve({ data: this.rest.rpc(name, parameters), error: null })
      },
    }

    await expect(callDocumentStudioRpc(client as never, 'create_document_studio_asset_server', { requested_mime: 'image/png' })).resolves.toEqual({
      name: 'create_document_studio_asset_server',
      parameters: { requested_mime: 'image/png' },
    })
  })
})
