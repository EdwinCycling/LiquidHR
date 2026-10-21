import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('./20261021160000_pmux03b_process_work_experience.sql', import.meta.url), 'utf8').toLowerCase()

describe('PMUX-03B process work experience projection', () => {
  it('keeps history reads behind the existing work-item read scope and immutable process version', () => {
    expect(migration).toContain('internal_security.process_work_item_can_read(item_row.tenant_id, item_row.hr_group_id, item_row.id)')
    expect(migration).toContain('version.id = instance_row.process_version_id')
    expect(migration).toContain('from public.process_events event')
    expect(migration).toContain('event.process_instance_id = instance_row.id')
    expect(migration).toContain('from public.process_work_item_notes note')
    expect(migration).toContain('note.work_item_id = item_row.id')
    expect(migration).toContain("note.action = 'request_changes'")
  })

  it('returns only presentation fields for steps, actions, outcomes and localized history', () => {
    for (const field of ['steptitle', 'eventtype', 'terminaloutcome', 'changerequests', 'next_routes', 'isconditional']) {
      expect(migration).toContain(field)
    }
    expect(migration).not.toContain('grant select on public.process_events')
    expect(migration).not.toContain('grant select on public.process_work_item_notes')
  })

  it('exposes only an authenticated public wrapper, never the internal security definer', () => {
    expect(migration).toContain('revoke all on function internal_security.get_process_work_item_experience(uuid, text)')
    expect(migration).toContain('from public, anon, authenticated')
    expect(migration).toContain('security definer')
    expect(migration).toContain('if auth.uid() is null then')
    expect(migration).toContain('grant execute on function public.get_process_work_item_experience(uuid, text)')
    expect(migration).not.toMatch(/grant execute on function internal_security\.get_process_work_item_experience/)
  })

  it('allows authenticated access through the guarded wrapper while denying direct internal and anon calls', async () => {
    const db = new PGlite()
    try {
      await db.exec(`
        create role authenticated;
        create role anon;
        create schema auth;
        create function auth.uid() returns uuid language sql stable as 'select ''00000000-0000-4000-8000-000000000001''::uuid';
        create schema internal_security;
        grant usage on schema internal_security to authenticated;
        create function internal_security.get_process_work_item_experience(uuid, text)
          returns jsonb language plpgsql stable security definer set search_path = '' as $$
          begin
            if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
            return jsonb_build_object('ok', true);
          end;
          $$;
        revoke all on function internal_security.get_process_work_item_experience(uuid, text)
          from public, anon, authenticated;
        create function public.get_process_work_item_experience(uuid, text)
          returns jsonb language plpgsql stable security definer set search_path = '' as $$
          begin
            if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
            return internal_security.get_process_work_item_experience($1, $2);
          end;
          $$;
        revoke all on function public.get_process_work_item_experience(uuid, text) from public, anon, authenticated;
        grant execute on function public.get_process_work_item_experience(uuid, text) to authenticated;
        set role authenticated;
      `)

      const result = await db.query("select public.get_process_work_item_experience('00000000-0000-4000-8000-000000000002', 'nl') as experience")
      expect(result.rows).toEqual([{ experience: { ok: true } }])
      await expect(db.query("select internal_security.get_process_work_item_experience('00000000-0000-4000-8000-000000000002', 'nl')")).rejects.toThrow(/permission denied/i)
      await db.exec('reset role; set role anon')
      await expect(db.query("select public.get_process_work_item_experience('00000000-0000-4000-8000-000000000002', 'nl')")).rejects.toThrow(/permission denied/i)
    } finally {
      await db.close()
    }
  })
})
