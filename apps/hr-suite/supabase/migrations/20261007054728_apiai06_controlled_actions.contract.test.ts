import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const migrationUrl = new URL('./20261007054728_apiai06_controlled_actions.sql', import.meta.url)

describe('APIAI-06 controlled-action migration contract', () => {
  it('extends the allowlists and reserves controlled draft writes for the server', async () => {
    const sql = await readFile(migrationUrl, 'utf8')

    expect(sql).toContain("'TALENT_DEVELOPMENT_GOAL_CREATE'")
    expect(sql).toContain("'TALENT_GOAL_CHECK_IN_CREATE'")
    expect(sql).toContain("'draft_talent_development_goal'")
    expect(sql).toContain("'draft_talent_goal_check_in'")
    expect(sql).not.toContain('create table')
    expect(sql).toContain('drop policy ai_action_drafts_owner_access on public.ai_action_drafts')
    expect(sql).toContain('create policy ai_action_drafts_owner_select on public.ai_action_drafts')
    expect(sql).toContain('create policy ai_action_drafts_owner_insert_legacy on public.ai_action_drafts')
    expect(sql).toContain('create policy ai_action_drafts_owner_update_legacy on public.ai_action_drafts')
    expect(sql).toContain('create policy ai_action_drafts_owner_delete_legacy on public.ai_action_drafts')
    expect(sql).toContain("action_type not in ('TALENT_DEVELOPMENT_GOAL_CREATE', 'TALENT_GOAL_CHECK_IN_CREATE')")
    expect(sql).toContain('grant select, insert, update on table public.ai_action_drafts to service_role;')
    expect(sql).not.toMatch(/grant\s+[^;]+\s+to authenticated/i)
  })

  it('audits controlled draft lifecycle changes through the existing audit_logs table', async () => {
    const sql = await readFile(migrationUrl, 'utf8')

    expect(sql).toContain('internal_security.audit_controlled_action_draft')
    expect(sql).toContain("set search_path = ''")
    expect(sql).toContain('after insert or update of status, confirmed_at on public.ai_action_drafts')
    expect(sql).toContain('insert into public.audit_logs')
    expect(sql).toContain("'ai_controlled_action'")
    expect(sql).toContain('    correlation_id')
    expect(sql).toContain("'EXECUTION_STARTED'")
    expect(sql).toContain("'EXECUTED'")
    expect(sql).toContain("'correlation_id', new.control_payload ->> 'correlationId'")
    expect(sql).toContain("nullif(new.control_payload ->> 'correlationId', '')::uuid")
    expect(sql).toContain("coalesce(auth.uid(), nullif(new.control_payload ->> 'actorUserId', '')::uuid)")
    expect(sql).not.toContain('new.payload')
    expect(sql).not.toContain('new.control_payload ->> \'newValue\'')
    expect(sql).toContain('revoke all on function internal_security.audit_controlled_action_draft() from public, anon, authenticated')
  })
})
