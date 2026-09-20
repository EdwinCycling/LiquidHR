import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20260914154120_conversational_ai_v2_team_logbook.sql'), 'utf8')
  .replace(/\r\n/g, '\n')
  .toLowerCase()

describe('Conversational AI V2 migration contract', () => {
  it('stores immutable Team AI scope metadata and fixed session membership', () => {
    expect(migration).toContain('create table public.ai_team_sessions')
    expect(migration).toContain('create table public.ai_team_session_members')
    expect(migration).toContain('scope_type text not null check (scope_type in (\'direct_team\', \'department\'))')
    expect(migration).toContain('constraint ai_team_session_members_session_fkey')
    expect(migration).toContain('revoke all on table public.ai_team_sessions, public.ai_team_session_members from public, anon, authenticated')
    expect(migration).toContain('grant select, insert, update on table public.ai_team_sessions, public.ai_team_session_members to service_role')
  })

  it('protects the personal logbook with owner, HR-group, and permission policies', () => {
    expect(migration).toContain('create table public.personal_logbook_entries')
    expect(migration).toContain('foreign key (tenant_id, hr_group_id, administration_id)')
    expect(migration).toContain("check (\n      (source = 'manual' and source_session_id is null)")
    expect(migration).toContain('on delete restrict')
    expect(migration).toContain("'ai-everywhere-v1.20260907.1'")
    expect(migration).toContain('alter table public.personal_logbook_entries enable row level security')
    expect(migration).toContain('owner_user_id = (select auth.uid())')
    expect(migration).toContain("current_user_has_hr_group_permission(tenant_id, hr_group_id, 'logbook:read')")
    expect(migration).toContain("current_user_has_hr_group_permission(tenant_id, hr_group_id, 'logbook:write')")
    expect(migration).toContain("current_user_has_hr_group_permission(tenant_id, hr_group_id, 'logbook:delete')")
    expect(migration).toContain("source in ('manual', 'ai_team_summary')")
  })

  it('audits mutations without copying private title or description values', () => {
    expect(migration).toContain('create or replace function internal_security.audit_personal_logbook_change()')
    expect(migration).toContain("'title_changed'")
    expect(migration).toContain("'description_changed'")
    expect(migration).not.toMatch(/jsonb_build_object\([\s\S]*['"]title['"]\s*,\s*current_row\s*->>/i)
    expect(migration).not.toMatch(/jsonb_build_object\([\s\S]*['"]description['"]\s*,\s*current_row\s*->>/i)
  })
})
