import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isContinuousAppraisalAttachmentStorageKey } from './attachment-storage-key'

const binding = {
  tenant_id: '11111111-1111-4111-8111-111111111111',
  item_id: '22222222-2222-4222-8222-222222222222',
  id: '33333333-3333-4333-8333-333333333333',
}

describe('continuous appraisal attachment storage key binding', () => {
  it('accepts a file under its tenant, item, and attachment id', () => {
    expect(isContinuousAppraisalAttachmentStorageKey({
      ...binding,
      storage_key: `${binding.tenant_id}/${binding.item_id}/${binding.id}/review.pdf`,
    })).toBe(true)
  })

  it.each([
    `${'44444444-4444-4444-8444-444444444444'}/${binding.item_id}/${binding.id}/review.pdf`,
    `${binding.tenant_id}/${'55555555-5555-4555-8555-555555555555'}/${binding.id}/review.pdf`,
    `${binding.tenant_id}/${binding.item_id}/${'66666666-6666-4666-8666-666666666666'}/review.pdf`,
    `${binding.tenant_id}/${binding.item_id}/${binding.id}/review.pdf/other.pdf`,
    `${binding.tenant_id}/${binding.item_id}/${binding.id}/`,
    `/${binding.tenant_id}/${binding.item_id}/${binding.id}/review.pdf`,
  ])('rejects a key outside the exact record path: %s', (storage_key) => {
    expect(isContinuousAppraisalAttachmentStorageKey({ ...binding, storage_key })).toBe(false)
  })

  it('keeps existing invalid rows unreadable and rejects new mismatched keys in the migration', () => {
    const migration = readFileSync(join(
      process.cwd(),
      'supabase',
      'migrations',
      '20261011120317_secure_continuous_appraisal_attachment_storage_keys.sql',
    ), 'utf8').toLowerCase()

    expect(migration).toMatch(/add constraint continuous_appraisal_attachments_storage_key_binding[\s\S]*check[\s\S]*storage\.foldername\(storage_key\)[\s\S]*not valid/)
    expect(migration).toMatch(/create policy continuous_appraisal_objects_read[\s\S]*storage\.foldername\(name\)[\s\S]*array\[attachment\.tenant_id::text,\s*attachment\.item_id::text,\s*attachment\.id::text\]/)
    expect(migration).toContain("coalesce(storage.filename(name), '') <> ''")
    expect(migration).not.toMatch(/\b(delete\s+from|truncate|drop\s+table)\b/)
  })
})
