import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('../../supabase/migrations/20261015080000_paytest_personas_employee_access_closeout.sql', import.meta.url), 'utf8')
const tenant = '07249eb9-545c-883b-b26b-d52f83b4f4a1'
const group = '6ba6f1df-e376-40f2-abff-ffdf000172e1'
const admin = '8483abc9-f275-c80b-5a23-fedc54ce9f0a'
async function database() {
  const db = new PGlite()
  await db.exec(`
    create schema auth;
    create table auth.users(id uuid primary key default gen_random_uuid(),email text,email_confirmed_at timestamptz default now(),is_anonymous boolean default false);
    create table public.hr_groups(id uuid primary key,tenant_id uuid,name text,is_active boolean default true);
    create table public.administrations(id uuid primary key,tenant_id uuid,hr_group_id uuid,name text,is_active boolean default true);
    create table public.management_roles(id uuid primary key default gen_random_uuid(),code text,tenant_id uuid,is_active boolean default true,deleted_at timestamptz);
    create table public.employees(id uuid primary key,auth_user_id uuid,tenant_id uuid,hr_group_id uuid,is_active boolean default true,is_archived boolean default false,deleted_at timestamptz);
    create table public.employments(id uuid primary key,employee_id uuid,tenant_id uuid,hr_group_id uuid,administration_id uuid,record_status text default 'CONFIRMED',deleted_at timestamptz);
    create table public.user_access(id uuid primary key default gen_random_uuid(),user_id uuid,tenant_id uuid,hr_group_id uuid,management_role_id uuid,scope_type text,administration_id uuid,is_active boolean);
    create table public.user_hr_group_access(id uuid primary key default gen_random_uuid(),user_id uuid,tenant_id uuid,hr_group_id uuid,management_role_id uuid,is_active boolean);
    create table public.audit_logs(id uuid primary key default gen_random_uuid(),tenant_id uuid,entity_name text,entity_id uuid,actor_user_id uuid,action text check(action in ('CREATE','UPDATE','ARCHIVE','DELETE','REVEAL','EXPORT','START','STOP','READ')),changes jsonb,subject_employee_id uuid);
    create function sync_access() returns trigger language plpgsql as $$ begin
      insert into public.user_hr_group_access(user_id,tenant_id,hr_group_id,management_role_id,is_active)
      values(new.user_id,new.tenant_id,new.hr_group_id,new.management_role_id,true); return new; end $$;
    create trigger sync_access after insert on public.user_access for each row execute function sync_access();
    insert into public.hr_groups values('${group}','${tenant}','Planeten',true);
    insert into public.administrations values('${admin}','${tenant}','${group}','Jupiter BV',true);
    insert into public.management_roles(code) values('EMPLOYEE');
    insert into auth.users(email) values('hradmin.fixture@liquidhr.test'),('jaap.test@liquidhr.test'),('frits.test@liquidhr.test');
    insert into public.employees(id,auth_user_id,tenant_id,hr_group_id)
      select e.id::uuid,u.id,'${tenant}','${group}' from (values
      ('dd9bde02-76bb-4f7c-8add-db544a148f3f','jaap.test@liquidhr.test'),
      ('79091d14-ef66-41fe-a2d5-92df108727e5','frits.test@liquidhr.test')) e(id,email) join auth.users u on u.email=e.email;
    insert into public.employments(id,employee_id,tenant_id,hr_group_id,administration_id) values
      ('29058c73-5cfa-409d-b9d4-80dd30f36962','dd9bde02-76bb-4f7c-8add-db544a148f3f','${tenant}','${group}','${admin}'),
      ('d19bace9-bb97-4822-a462-eed22821ed05','79091d14-ef66-41fe-a2d5-92df108727e5','${tenant}','${group}','${admin}');
  `)
  return db
}
describe('one-time Jupiter Employee access repair', () => {
  it('adds exactly two scoped assignments and audit events and reuses them on replay', async () => {
    const db = await database()
    try {
      await db.exec(migration)
      await db.exec(migration)
      const result = await db.query<{ count: number }>('select count(*)::integer count from public.user_access')
      expect(result.rows[0].count).toBe(2)
      expect((await db.query<{ count: number }>('select count(*)::integer count from public.audit_logs')).rows[0].count).toBe(2)
      expect((await db.query<{ count: number }>(`select count(*)::integer count from public.user_access where scope_type='ADMINISTRATION' and administration_id='${admin}'`)).rows[0].count).toBe(2)
    } finally { await db.close() }
  })
  it('rolls back both assignments when the second identity has the wrong employment scope', async () => {
    const db = await database()
    try {
      await db.exec("update public.employments set administration_id=gen_random_uuid() where id='d19bace9-bb97-4822-a462-eed22821ed05'")
      await expect(db.exec(migration)).rejects.toThrow()
      expect((await db.query<{ count: number }>('select count(*)::integer count from public.user_access')).rows[0].count).toBe(0)
    } finally { await db.close() }
  })
  it('rejects pre-existing broader access and introduces no persistent privilege mechanism', async () => {
    const db = await database()
    try {
      await db.exec(`insert into public.user_access(user_id,tenant_id,management_role_id,scope_type,is_active)
        select u.id,'${tenant}',r.id,'TENANT',true from auth.users u cross join public.management_roles r where u.email='frits.test@liquidhr.test'`)
      await expect(db.exec(migration)).rejects.toThrow('PERSONA_CLOSEOUT_IDENTITY_OR_ACCESS_CONFLICT')
      expect((await db.query<{ count: number }>('select count(*)::integer count from public.user_access')).rows[0].count).toBe(1)
      expect(migration).not.toMatch(/create\s+(or\s+replace\s+)?function|grant\s+execute|create\s+policy/i)
    } finally { await db.close() }
  })
})
