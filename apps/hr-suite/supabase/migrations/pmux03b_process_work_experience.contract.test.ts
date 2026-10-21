import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'

const migrationSource = readFileSync(new URL('./20261021160000_pmux03b_process_work_experience.sql', import.meta.url), 'utf8')
const migration = migrationSource.toLowerCase()

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

  it('executes the local migration and scopes its real projection to the readable item and pinned version', async () => {
    const db = new PGlite()
    const ids = {
      manager: '00000000-0000-4000-8000-000000000001',
      employee: '00000000-0000-4000-8000-000000000002',
      tenantA: '00000000-0000-4000-8000-000000000010',
      tenantB: '00000000-0000-4000-8000-000000000011',
      groupA: '00000000-0000-4000-8000-000000000020',
      groupB: '00000000-0000-4000-8000-000000000021',
      definitionA: '00000000-0000-4000-8000-000000000030',
      definitionB: '00000000-0000-4000-8000-000000000031',
      versionPinned: '00000000-0000-4000-8000-000000000040',
      versionLater: '00000000-0000-4000-8000-000000000041',
      versionTenantB: '00000000-0000-4000-8000-000000000042',
      instanceA: '00000000-0000-4000-8000-000000000050',
      instanceB: '00000000-0000-4000-8000-000000000051',
      workItemA: '00000000-0000-4000-8000-000000000060',
      workItemAOtherStep: '00000000-0000-4000-8000-000000000061',
      workItemB: '00000000-0000-4000-8000-000000000062',
      eventStarted: '00000000-0000-4000-8000-000000000070',
      eventChanges: '00000000-0000-4000-8000-000000000071',
      eventTenantB: '00000000-0000-4000-8000-000000000072',
      noteForItemA: '00000000-0000-4000-8000-000000000080',
      noteForOtherItem: '00000000-0000-4000-8000-000000000081',
      noteTenantB: '00000000-0000-4000-8000-000000000082',
    }
    const pinnedDefinition = {
      content: {
        steps: [
          { key: 'manager-review', title: { nl: 'Manager beoordeelt', en: 'Manager reviews' }, allowedActions: ['APPROVE', 'REQUEST_CHANGES', 'REJECT'] },
          { key: 'employee-update', title: { nl: 'Medewerker past aan', en: 'Employee updates' }, allowedActions: ['SUBMIT'] },
          { key: 'hr-process', title: { nl: 'HR verwerkt', en: 'HR processes' }, allowedActions: ['COMPLETE'] },
          { key: 'rejected-end', title: { nl: 'Afgewezen', en: 'Declined' }, terminalOutcome: 'REJECTED', allowedActions: [] },
        ],
        transitions: [
          { fromStepKey: 'manager-review', action: 'APPROVE', toStepKey: 'hr-process', label: { nl: 'Goedkeuren', en: 'Approve' } },
          { fromStepKey: 'manager-review', action: 'REQUEST_CHANGES', toStepKey: 'employee-update', label: { nl: 'Wijzigingen vragen', en: 'Request changes' }, condition: { field: 'cost' } },
          { fromStepKey: 'manager-review', action: 'REJECT', toStepKey: 'rejected-end', label: { nl: 'Afwijzen', en: 'Decline' } },
          { fromStepKey: 'manager-review', action: 'COMPLETE', toStepKey: 'hr-process', label: { nl: 'Niet toegestaan', en: 'Not allowed' } },
        ],
      },
    }
    const laterDefinition = structuredClone(pinnedDefinition)
    laterDefinition.content.steps[0]!.title.nl = 'Manager beoordeelt (nieuwe versie)'

    try {
      await db.exec(`
        create role authenticated;
        create role anon;
        create schema auth;
        create function auth.uid() returns uuid
          language sql stable
          as $$ select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid $$;

        create schema internal_security;
        grant usage on schema internal_security to authenticated;
        create table internal_security.process_work_item_read_access (
          actor_user_id uuid not null,
          tenant_id uuid not null,
          hr_group_id uuid not null,
          work_item_id uuid not null
        );
        create function internal_security.process_work_item_can_read(
          requested_tenant_id uuid,
          requested_hr_group_id uuid,
          requested_work_item_id uuid
        ) returns boolean
          language sql stable security definer set search_path = ''
          as $$
            select exists (
              select 1
              from internal_security.process_work_item_read_access access_row
              where access_row.actor_user_id = auth.uid()
                and access_row.tenant_id = requested_tenant_id
                and access_row.hr_group_id = requested_hr_group_id
                and access_row.work_item_id = requested_work_item_id
            )
          $$;
        revoke all on function internal_security.process_work_item_can_read(uuid, uuid, uuid)
          from public, anon, authenticated;

        create function internal_security.process_definition_content(requested_definition jsonb)
          returns jsonb language sql immutable security definer set search_path = ''
          as $$
            select case
              when pg_catalog.jsonb_typeof(requested_definition -> 'content') = 'object'
                then requested_definition -> 'content'
              else requested_definition
            end
          $$;
        create function internal_security.process_localized_text(
          requested_value jsonb,
          requested_language text,
          requested_fallback text
        ) returns text language sql immutable
          as $$
            select coalesce(
              requested_value ->> case when requested_language = 'en' then 'en' else 'nl' end,
              requested_value ->> 'nl',
              requested_value ->> 'en',
              requested_fallback
            )
          $$;

        create table public.process_work_items (
          id uuid primary key,
          tenant_id uuid not null,
          hr_group_id uuid not null,
          process_instance_id uuid not null,
          step_key text not null
        );
        create table public.process_instances (
          id uuid primary key,
          tenant_id uuid not null,
          hr_group_id uuid not null,
          process_definition_id uuid not null,
          process_version_id uuid not null
        );
        create table public.process_versions (
          id uuid primary key,
          tenant_id uuid not null,
          hr_group_id uuid not null,
          process_definition_id uuid not null,
          definition_json jsonb not null
        );
        create table public.process_events (
          id uuid primary key,
          event_type text not null,
          payload jsonb not null,
          created_at timestamptz not null,
          sequence_number bigint not null,
          tenant_id uuid not null,
          hr_group_id uuid not null,
          process_instance_id uuid not null
        );
        create table public.process_work_item_notes (
          id uuid primary key,
          body text not null,
          created_at timestamptz not null,
          tenant_id uuid not null,
          hr_group_id uuid not null,
          process_instance_id uuid not null,
          work_item_id uuid not null,
          action text not null
        );
      `)

      await db.query(
        'insert into public.process_versions (id, tenant_id, hr_group_id, process_definition_id, definition_json) values ($1, $2, $3, $4, $5::jsonb), ($6, $2, $3, $4, $7::jsonb), ($8, $9, $10, $11, $5::jsonb)',
        [
          ids.versionPinned, ids.tenantA, ids.groupA, ids.definitionA, JSON.stringify(pinnedDefinition),
          ids.versionLater, JSON.stringify(laterDefinition),
          ids.versionTenantB, ids.tenantB, ids.groupB, ids.definitionB,
        ],
      )
      await db.query(
        'insert into public.process_instances (id, tenant_id, hr_group_id, process_definition_id, process_version_id) values ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)',
        [ids.instanceA, ids.tenantA, ids.groupA, ids.definitionA, ids.versionPinned, ids.instanceB, ids.tenantB, ids.groupB, ids.definitionB, ids.versionTenantB],
      )
      await db.query(
        'insert into public.process_work_items (id, tenant_id, hr_group_id, process_instance_id, step_key) values ($1, $2, $3, $4, $5), ($6, $2, $3, $4, $7), ($8, $9, $10, $11, $5)',
        [ids.workItemA, ids.tenantA, ids.groupA, ids.instanceA, 'manager-review', ids.workItemAOtherStep, 'employee-update', ids.workItemB, ids.tenantB, ids.groupB, ids.instanceB],
      )
      await db.query(
        'insert into public.process_events (id, event_type, payload, created_at, sequence_number, tenant_id, hr_group_id, process_instance_id) values ($1, $2, $3::jsonb, $4, 1, $5, $6, $7), ($8, $9, $10::jsonb, $11, 2, $5, $6, $7), ($12, $13, $14::jsonb, $15, 1, $16, $17, $18)',
        [
          ids.eventStarted, 'PROCESS_STARTED', JSON.stringify({ stepKey: 'manager-review' }), '2026-10-01T08:00:00Z', ids.tenantA, ids.groupA, ids.instanceA,
          ids.eventChanges, 'PROCESS_WORK_ITEM_ACTIONED', JSON.stringify({ action: 'REQUEST_CHANGES', stepKey: 'manager-review' }), '2026-10-02T08:00:00Z',
          ids.eventTenantB, 'CROSS_TENANT_EVENT', JSON.stringify({ action: 'DO_NOT_LEAK', stepKey: 'manager-review' }), '2026-10-03T08:00:00Z', ids.tenantB, ids.groupB, ids.instanceB,
        ],
      )
      await db.query(
        'insert into public.process_work_item_notes (id, body, created_at, tenant_id, hr_group_id, process_instance_id, work_item_id, action) values ($1, $2, $3, $4, $5, $6, $7, $8), ($9, $10, $11, $4, $5, $6, $12, $8), ($13, $14, $15, $16, $17, $18, $19, $8)',
        [
          ids.noteForItemA, 'Voeg een kostenraming toe.', '2026-10-02T08:00:00Z', ids.tenantA, ids.groupA, ids.instanceA, ids.workItemA, 'REQUEST_CHANGES',
          ids.noteForOtherItem, 'Notitie voor een andere stap.', '2026-10-02T09:00:00Z', ids.workItemAOtherStep,
          ids.noteTenantB, 'Notitie van andere tenant.', '2026-10-03T08:00:00Z', ids.tenantB, ids.groupB, ids.instanceB, ids.workItemB,
        ],
      )
      await db.query(
        'insert into internal_security.process_work_item_read_access (actor_user_id, tenant_id, hr_group_id, work_item_id) values ($1, $2, $3, $4), ($5, $6, $7, $8), ($5, $2, $7, $4)',
        [ids.manager, ids.tenantA, ids.groupA, ids.workItemA, ids.employee, ids.tenantB, ids.groupB, ids.workItemB],
      )

      await db.exec(migrationSource)

      await db.query("select pg_catalog.set_config('request.jwt.claim.sub', $1, false)", [ids.manager])
      await db.exec('set role authenticated')
      const result = await db.query<{ experience: unknown }>('select public.get_process_work_item_experience($1, $2) as experience', [ids.workItemA, 'nl'])
      const projection = result.rows[0]?.experience as {
        steps: Array<{ stepKey: string; title: string }>
        history: Array<{ id: string; action: string | null; stepTitle: string | null }>
        changeRequests: Array<{ id: string; body: string }>
        nextRoutes: Array<{ action: string; label: string; toStepTitle: string | null; terminalOutcome: string | null; isConditional: boolean }>
      }
      expect(projection.steps.map((step) => step.title)).toEqual(['Manager beoordeelt', 'Medewerker past aan', 'HR verwerkt', 'Afgewezen'])
      expect(projection.steps.some((step) => step.title.includes('nieuwe versie'))).toBe(false)
      expect(projection.history.map((event) => event.id)).toEqual([ids.eventStarted, ids.eventChanges])
      expect(projection.history[1]).toMatchObject({ action: 'REQUEST_CHANGES', stepTitle: 'Manager beoordeelt' })
      expect(projection.changeRequests).toHaveLength(1)
      expect(projection.changeRequests[0]).toMatchObject({ id: ids.noteForItemA, body: 'Voeg een kostenraming toe.' })
      expect(JSON.stringify(projection.changeRequests)).not.toContain('Notitie voor een andere stap')
      expect(JSON.stringify(projection.changeRequests)).not.toContain('Notitie van andere tenant')
      expect(projection.nextRoutes.map((route) => route.action)).toEqual(['APPROVE', 'REQUEST_CHANGES', 'REJECT'])
      expect(projection.nextRoutes[0]).toMatchObject({ label: 'Goedkeuren', toStepTitle: 'HR verwerkt', terminalOutcome: null, isConditional: false })
      expect(projection.nextRoutes[1]).toMatchObject({ label: 'Wijzigingen vragen', toStepTitle: 'Medewerker past aan', isConditional: true })
      expect(projection.nextRoutes[2]).toMatchObject({ label: 'Afwijzen', toStepTitle: 'Afgewezen', terminalOutcome: 'REJECTED' })

      await db.query("select pg_catalog.set_config('request.jwt.claim.sub', $1, false)", [ids.employee])
      await expect(db.query('select public.get_process_work_item_experience($1, $2)', [ids.workItemA, 'nl'])).rejects.toThrow(/FORBIDDEN/)

      await db.query("select pg_catalog.set_config('request.jwt.claim.sub', $1, false)", [ids.manager])
      await expect(db.query('select public.get_process_work_item_experience($1, $2)', [ids.workItemB, 'nl'])).rejects.toThrow(/FORBIDDEN/)
      await expect(db.query('select internal_security.get_process_work_item_experience($1, $2)', [ids.workItemA, 'nl'])).rejects.toThrow(/permission denied/i)

      await db.query("select pg_catalog.set_config('request.jwt.claim.sub', '', false)")
      await expect(db.query('select public.get_process_work_item_experience($1, $2)', [ids.workItemA, 'nl'])).rejects.toThrow(/AUTHENTICATION_REQUIRED/)
      await db.exec('reset role; set role anon')
      await expect(db.query('select public.get_process_work_item_experience($1, $2)', [ids.workItemA, 'nl'])).rejects.toThrow(/permission denied/i)
    } finally {
      await db.close()
    }
  })
})
