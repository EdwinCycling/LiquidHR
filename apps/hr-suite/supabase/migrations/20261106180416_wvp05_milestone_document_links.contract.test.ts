import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`
const tenant = id(1), group = id(2), administration = id(3), hr = id(4), manager = id(5), employeeUser = id(6), managerWithoutDocumentRead = id(7)
const employee = id(8), otherEmployee = id(9), caseId = id(10), closedCaseId = id(11), otherCaseId = id(20), otherGroupCaseId = id(30), otherAdministrationCaseId = id(31), foreignTenantCaseId = id(32)
const taskId = id(50), otherCaseTaskId = id(51), invalidTaskId = id(52)
const closedTaskId = id(54)
const documentId = id(60), otherEmployeeDocumentId = id(61), otherAdministrationDocumentId = id(62), foreignTenantDocumentId = id(63)
let db: PGlite

async function setActor(actor: string) { await db.query("select set_config('test.actor',$1,false)", [actor]) }
async function list(caseIdArg = caseId) {
  return (await db.query<{ data: Array<{ id: string; taskId: string; documentId: string }> }>(
    'select public.wvp_document_links($1,$2,$3,$4) data', [tenant, group, administration, caseIdArg],
  )).rows[0].data
}
async function add(caseIdArg: string, taskIdArg: string, documentIdArg: string, scopes = [tenant, group, administration]) {
  return (await db.query<{ id: string }>(
    'select public.wvp_document_link_add($1,$2,$3,$4,$5,$6) id', [...scopes, caseIdArg, taskIdArg, documentIdArg],
  )).rows[0].id
}
async function remove(linkId: string, caseIdArg = caseId) {
  return (await db.query<{ removed: boolean }>(
    'select public.wvp_document_link_remove($1,$2,$3,$4,$5) removed', [tenant, group, administration, caseIdArg, linkId],
  )).rows[0].removed
}
async function expectDenied(operation: () => Promise<unknown>, code: string) {
  await db.exec('savepoint expected_denial')
  try { await expect(operation()).rejects.toThrow(code) }
  finally { await db.exec('rollback to savepoint expected_denial'); await db.exec('release savepoint expected_denial') }
}

describe('WVP05 documentkoppelingen databasecontract', () => {
  beforeAll(async () => {
    db = new PGlite()
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth; create schema internal_security;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.actor',true),'')::uuid $$;
      create table public.absence_cases(id uuid primary key,tenant_id uuid not null,hr_group_id uuid not null,administration_id uuid not null,employee_id uuid not null,archived_at timestamptz);
      create table public.absence_guidance(case_id uuid primary key,tenant_id uuid not null,hr_group_id uuid not null,administration_id uuid not null,closed_at timestamptz);
      create table public.absence_tasks(id uuid primary key,tenant_id uuid not null,hr_group_id uuid not null,case_id uuid not null,milestone_code text not null,unique(case_id,id));
      create table public.document_categories(id uuid primary key,requires_salary_permission boolean not null default false);
      create table public.employee_documents(id uuid primary key,tenant_id uuid not null,administration_id uuid not null,employee_id uuid not null,category_id uuid not null,title text not null,original_filename text not null,created_at timestamptz not null default now(),deleted_at timestamptz);
      create table public.audit_logs(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,administration_id uuid,entity_name text not null,entity_id uuid not null,actor_user_id uuid,action text not null,changes jsonb not null,created_at timestamptz not null default now());
      create function internal_security.current_employee_id(uuid,uuid) returns uuid language sql stable as $$ select case when auth.uid()='${employeeUser}' then '${employee}'::uuid end $$;
      create function internal_security.current_employee_is_preboarding(uuid,uuid) returns boolean language sql stable as $$ select false $$;
      create function internal_security.current_employee_has_permission(text) returns boolean language sql stable as $$ select $1='self:absence:read' $$;
      create function internal_security.has_hr_group_access(uuid,uuid) returns boolean language sql stable as $$ select auth.uid() in ('${hr}','${manager}','${employeeUser}','${managerWithoutDocumentRead}') and $1='${tenant}' and $2='${group}' $$;
      create function internal_security.can_manage_employee(uuid,text) returns boolean language sql stable as $$ select auth.uid()='${hr}' or (auth.uid() in ('${manager}','${managerWithoutDocumentRead}') and $1='${employee}') $$;
      create function internal_security.process_scope_has_permission(uuid,uuid,text,uuid,text) returns boolean language sql stable as $$ select $1='${tenant}' and $2='${group}' and $4='${administration}' and auth.uid() in ('${hr}','${manager}','${managerWithoutDocumentRead}') $$;
      create function internal_security.wvp_case_access(c public.absence_cases,writing boolean default false) returns boolean language sql stable security definer set search_path='' as $$
        select coalesce(auth.uid() is not null and internal_security.has_hr_group_access(c.tenant_id,c.hr_group_id) and c.archived_at is null and (
          (not writing and c.employee_id=internal_security.current_employee_id(c.tenant_id,c.hr_group_id) and internal_security.current_employee_has_permission('self:absence:read'))
          or (internal_security.can_manage_employee(c.employee_id,case when writing then 'absence:write' else 'absence:read' end) and internal_security.process_scope_has_permission(c.tenant_id,c.hr_group_id,'ADMINISTRATION',c.administration_id,case when writing then 'absence:write' else 'absence:read' end))
        ),false)
      $$;
      create function internal_security.can_access_document(requested_document_id uuid,requested_permission text) returns boolean language sql stable security definer set search_path='' as $$
        select exists(select 1 from public.employee_documents d join public.document_categories c on c.id=d.category_id where d.id=requested_document_id and d.deleted_at is null and (auth.uid() in ('${hr}','${manager}') and internal_security.can_manage_employee(d.employee_id,requested_permission) or (d.employee_id='${employee}' and auth.uid()='${employeeUser}' and requested_permission='document:read')) and (not c.requires_salary_permission or auth.uid()='${hr}'))
      $$;
      create function public.can_access_employee_dossier(requested_employee_id uuid,requested_permission text) returns boolean language sql stable security definer set search_path='' as $$
        select auth.uid() is not null and (auth.uid() in ('${hr}','${manager}') and internal_security.can_manage_employee(requested_employee_id,requested_permission) or (requested_employee_id='${employee}' and auth.uid()='${employeeUser}' and requested_permission='document:read'))
      $$;
      insert into auth.users values('${hr}'),('${manager}'),('${employeeUser}'),('${managerWithoutDocumentRead}');
      insert into public.document_categories(id) values('${id(70)}');
      insert into public.document_categories(id,requires_salary_permission) values('${id(71)}',true);
      insert into public.absence_cases values
        ('${caseId}','${tenant}','${group}','${administration}','${employee}',null),
        ('${closedCaseId}','${tenant}','${group}','${administration}','${employee}',null),
        ('${otherCaseId}','${tenant}','${group}','${administration}','${otherEmployee}',null),
        ('${otherGroupCaseId}','${tenant}','${id(91)}','${administration}','${employee}',null),
        ('${otherAdministrationCaseId}','${tenant}','${group}','${id(92)}','${employee}',null),
        ('${foreignTenantCaseId}','${id(90)}','${group}','${administration}','${employee}',null);
      insert into public.absence_guidance values
        ('${caseId}','${tenant}','${group}','${administration}',null),
        ('${closedCaseId}','${tenant}','${group}','${administration}',now()),
        ('${otherCaseId}','${tenant}','${group}','${administration}',null),
        ('${otherGroupCaseId}','${tenant}','${id(91)}','${administration}',null),
        ('${otherAdministrationCaseId}','${tenant}','${group}','${id(92)}',null),
        ('${foreignTenantCaseId}','${id(90)}','${group}','${administration}',null);
      insert into public.absence_tasks values
        ('${taskId}','${tenant}','${group}','${caseId}','WVP_WEEK_6'),
        ('${closedTaskId}','${tenant}','${group}','${closedCaseId}','WVP_WEEK_6'),
        ('${id(53)}','${tenant}','${group}','${caseId}','WVP_WEEK_8'),
        ('${otherCaseTaskId}','${tenant}','${group}','${otherCaseId}','WVP_WEEK_6'),
        ('${invalidTaskId}','${tenant}','${group}','${caseId}','CUSTOM_TASK');
      insert into public.employee_documents values
        ('${documentId}','${tenant}','${administration}','${employee}','${id(70)}','Werkafspraak.pdf','werkafspraak.pdf',now(),null),
        ('${otherEmployeeDocumentId}','${tenant}','${administration}','${otherEmployee}','${id(70)}','Ander dossier.pdf','ander.pdf',now(),null),
        ('${otherAdministrationDocumentId}','${tenant}','${id(92)}','${employee}','${id(70)}','Andere administratie.pdf','ander-admin.pdf',now(),null),
        ('${foreignTenantDocumentId}','${id(90)}','${administration}','${employee}','${id(70)}','Andere tenant.pdf','ander-tenant.pdf',now(),null);
    `)
    await db.exec(readFileSync(new URL('./20261106180416_wvp05_milestone_document_links.sql', import.meta.url), 'utf8'))
    await db.exec(`
      grant usage on schema internal_security,auth to authenticated;
      -- The production absence foundation already grants this SELECT; reproduce it in the isolated fixture.
      grant select on public.absence_cases to authenticated;
      grant execute on function internal_security.wvp_case_access(public.absence_cases,boolean) to authenticated;
      grant execute on function internal_security.can_access_document(uuid,text) to authenticated;
      grant execute on function public.can_access_employee_dossier(uuid,text) to authenticated;
    `)
  }, 30000)

  afterAll(async () => { await db?.close() })
  beforeEach(async () => { await db.exec('begin'); await setActor(hr) })
  afterEach(async () => { try { await db.exec('reset role') } catch {} await db.exec('rollback') })

  it('HR Admin en bevoegde Manager kunnen binnen de casus koppelen; herhaling is idempotent', async () => {
    await setActor(hr)
    const first = await add(caseId, taskId, documentId)
    expect(await add(caseId, taskId, documentId)).toBe(first)
    expect(await list()).toEqual([{ id: first, taskId, documentId, createdAt: expect.any(String) }])
    await setActor(manager)
    expect(await add(caseId, id(53), documentId)).toBeTruthy()
    expect((await db.query('select action from public.audit_logs where entity_name=\'wvp_document_link\'')).rows).toHaveLength(2)
  })

  it('weigert andere team-, HR-groep-, administratie-, tenant- en medewerkerscopes zonder gedeeltelijke mutaties', async () => {
    await setActor(manager)
    await expectDenied(() => add(otherCaseId, otherCaseTaskId, otherEmployeeDocumentId), 'WVP_FORBIDDEN')
    await setActor(hr)
    await expectDenied(() => add(otherAdministrationCaseId, taskId, documentId), 'WVP_FORBIDDEN')
    await expectDenied(() => add(foreignTenantCaseId, taskId, documentId), 'WVP_FORBIDDEN')
    for (const scopes of [[id(90), group, administration], [tenant, id(91), administration], [tenant, group, id(92)]]) {
      await expectDenied(() => add(caseId, taskId, documentId, scopes), 'WVP_FORBIDDEN')
    }
    await expectDenied(() => add(otherGroupCaseId, taskId, documentId), 'WVP_FORBIDDEN')
    for (const document of [otherEmployeeDocumentId, otherAdministrationDocumentId, foreignTenantDocumentId]) {
      await expectDenied(() => add(caseId, taskId, document), 'WVP_FORBIDDEN')
    }
    await setActor(managerWithoutDocumentRead)
    await expectDenied(() => add(caseId, taskId, documentId), 'WVP_FORBIDDEN')
    await expectDenied(() => add(caseId, otherCaseTaskId, documentId), 'WVP_MILESTONE_INVALID')
    await expectDenied(() => add(caseId, invalidTaskId, documentId), 'WVP_MILESTONE_INVALID')
    expect((await db.query('select * from public.wvp_document_links')).rows).toHaveLength(0)
    expect((await db.query('select * from public.audit_logs where entity_name=\'wvp_document_link\'')).rows).toHaveLength(0)
  })

  it('laat Employee uitsluitend eigen toegankelijke koppelingen lezen en weigert mutaties', async () => {
    await setActor(hr)
    const linkId = await add(caseId, taskId, documentId)
    await setActor(employeeUser)
    expect(await list()).toEqual([{ id: linkId, taskId, documentId, createdAt: expect.any(String) }])
    await expectDenied(() => add(caseId, taskId, documentId), 'WVP_FORBIDDEN')
    await expectDenied(() => remove(linkId), 'WVP_FORBIDDEN')
    await setActor(id(99))
    await expectDenied(() => list(), 'WVP_FORBIDDEN')
  })

  it('verwijdert uitsluitend de koppeling, houdt het document intact en auditeert zonder inhoud of vrije tekst', async () => {
    await setActor(hr)
    const linkId = await add(caseId, taskId, documentId)
    expect(await remove(linkId)).toBe(true)
    expect(await remove(linkId)).toBe(false)
    expect(await list()).toEqual([])
    expect((await db.query('select id from public.employee_documents where id=$1 and deleted_at is null', [documentId])).rows).toHaveLength(1)
    const audit = await db.query<{ action: string; changes: unknown }>("select action,changes from public.audit_logs where entity_name='wvp_document_link' order by created_at")
    expect(audit.rows.map(row => row.action)).toEqual(['CREATE', 'DELETE'])
    expect(JSON.stringify(audit.rows)).not.toMatch(/title|filename|diagnosis|treatment|medical|description/i)
    expect((await db.query<{ column_name: string }>("select column_name from information_schema.columns where table_name='wvp_document_links'")).rows.map(row => row.column_name)).not.toContain('metadata')
  })

  it('weigert koppelen en ontkoppelen na sluiten van de WVP-casus', async () => {
    await setActor(hr)
    await expectDenied(() => add(closedCaseId, closedTaskId, documentId), 'WVP_CLOSED')
    const linkId = await add(caseId, taskId, documentId)
    await db.query('update public.absence_guidance set closed_at=now() where case_id=$1', [caseId])
    await expectDenied(() => remove(linkId), 'WVP_CLOSED')
    expect((await db.query<{ removed_at: string | null }>('select removed_at from public.wvp_document_links where id=$1', [linkId])).rows[0].removed_at).toBeNull()
    expect((await db.query("select action from public.audit_logs where entity_name='wvp_document_link'")).rows).toHaveLength(1)
  })

  it('filtert documentlezers via RLS en weigert directe writes', async () => {
    await setActor(hr)
    const linkId = await add(caseId, taskId, documentId)
    expect((await db.query<{ enabled: boolean }>("select relrowsecurity enabled from pg_class where oid='public.wvp_document_links'::regclass")).rows[0].enabled).toBe(true)
    for (const role of ['anon', 'authenticated']) for (const operation of ['INSERT', 'UPDATE', 'DELETE']) {
      expect((await db.query<{ allowed: boolean }>('select has_table_privilege($1,\'public.wvp_document_links\',$2) allowed', [role, operation])).rows[0].allowed).toBe(false)
    }
    await db.exec('set role authenticated')
    await setActor(managerWithoutDocumentRead)
    expect((await db.query('select * from public.wvp_document_links')).rows).toHaveLength(0)
    await db.exec('reset role')
    await setActor(manager)
    await db.exec('set role authenticated')
    expect((await db.query('select * from public.wvp_document_links')).rows).toHaveLength(1)
    await db.exec('reset role')
    await setActor(employeeUser)
    await db.exec('set role authenticated')
    expect((await db.query('select * from public.wvp_document_links')).rows).toHaveLength(1)
    await db.exec('reset role')
    await setActor(id(99))
    await db.exec('set role authenticated')
    expect((await db.query('select * from public.wvp_document_links')).rows).toHaveLength(0)
    await db.exec('reset role')
    expect(linkId).toBeTruthy()
  })
})
