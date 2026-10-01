import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const migration = readFileSync(resolve(__dirname, '20260929111847_control01_hr_group_update.sql'), 'utf8')

describe('CONTROL01 HR-group update migration contract', () => {
  it('keeps updates bound to an active platform writer and the requested tenant/group pair', () => {
    expect(migration).toContain('internal_security.is_platform_operator(array[')
    expect(migration).toContain("'OWNER'::public.platform_operator_role")
    expect(migration).toContain("'OPERATOR'::public.platform_operator_role")
    expect(migration).toContain('where group_row.id = requested_hr_group_id')
    expect(migration).toContain('and group_row.tenant_id = requested_tenant_id')
    expect(migration).toContain('HR_GROUP_NOT_FOUND')
  })

  it('changes only the editable name and description and writes a before/after audit event', () => {
    expect(migration).toMatch(/set name = next_name,\s+description = next_description,/)
    expect(migration).toContain("'HR_GROUP_UPDATED'")
    expect(migration).toContain('before_state')
    expect(migration).toContain('after_state')
    expect(migration).not.toMatch(/set\s+code\s*=/i)
    expect(migration).not.toMatch(/set\s+tenant_id\s*=/i)
  })

  it('uses a fixed search path and denies public and anonymous RPC execution', () => {
    expect(migration).toMatch(/security definer\s+set search_path = ''/i)
    expect(migration).toContain('revoke all on function public.update_platform_hr_group(uuid, uuid, text, text) from public, anon, authenticated')
    expect(migration).toContain('grant execute on function public.update_platform_hr_group(uuid, uuid, text, text) to authenticated')
  })
})