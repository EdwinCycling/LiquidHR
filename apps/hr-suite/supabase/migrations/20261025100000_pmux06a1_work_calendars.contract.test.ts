import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const read = (name: string) => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8')
const migration = read('20261025100000_pmux06a1_work_calendars.sql')
function fn(source: string, name: string) {
  const start = source.indexOf(`create or replace function internal_security.${name}(`)
  const end = source.indexOf('$$;', start)
  if (start < 0 || end < 0) throw new Error(name)
  return source.slice(start, end + 3)
}
const p4 = read('20260808142249_process_automation_p4_runtime_engine.sql')
const p7 = read('20260808170647_process_automation_p7_job_schema.sql')
const sla = read('20261023072351_pmux06a_materialize_process_sla_deadlines.sql')
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const tenant = id(1), group = id(2), admin = id(3), manager = id(4), employee = id(5), administration = id(6), foreignGroup = id(7), foreignAdministration = id(8)
const definition = id(9), processVersion = id(10), instance = id(11)
let db: PGlite
const config = (changes: Record<string, unknown> = {}) => ({ name: 'Planeten werkweek', weekdays: [1,2,3,4,5], validFrom: '2026-01-01', validUntil: '2027-12-31', holidayIds: [], exceptions: [], holidaySelectionConfirmed: true, reason: 'Expliciete publicatie', ...changes })
async function actor(user = admin) {
  await db.exec('reset role;')
  await db.query("select set_config('test.actor',$1,false)", [user])
  await db.exec('set role authenticated;')
}
async function publish(changes: Record<string, unknown> = {}, revision = 0, scope: string | null = administration) {
  const result = await db.query<{ data: { calendarId: string; versionId: string; revision: number } }>('select public.publish_work_calendar($1,$2,$3::jsonb,$4) as data', [group,scope,JSON.stringify(config(changes)),revision])
  return result.rows[0].data
}
async function preview(version: string, local: string, days = 2) {
  return (await db.query<{ data: { deadlineAt: string; calendarVersionId: string; countedDates: string[]; skippedDates: string[] } }>('select public.preview_work_calendar_deadline($1,$2::timestamp,$3) as data', [version,local,days])).rows[0].data
}
async function activate(instant: string, businessDays = true, unit = 'DAYS', amount = 2) {
  await db.exec('reset role;')
  await db.query('update public.process_versions set definition_json=$1::jsonb where id=$2', [JSON.stringify({ content: { steps: [{ key: 'request', sla: { duration: { amount, unit }, businessDays } }] } }),processVersion])
  return (await db.query<{ id: string; deadline_at: Date; work_calendar_version_id: string | null }>(`insert into public.process_step_instances(tenant_id,hr_group_id,process_instance_id,process_version_id,step_key,status,activated_at) values($1,$2,$3,$4,'request','ACTIVE',$5) returning id,deadline_at,work_calendar_version_id`, [tenant,group,instance,processVersion,instant])).rows[0]
}

describe('PMUX-06A.1 canonical work calendar', () => {
  beforeAll(async () => {
    db = new PGlite()
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth; create schema internal_security;
      create type public.access_scope_type as enum('HR_GROUP','ADMINISTRATION');
      create type public.process_step_instance_status as enum('ACTIVE','COMPLETED');
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.actor',true),'')::uuid $$;
      create table public.hr_groups(tenant_id uuid,id uuid,is_active boolean,time_zone text,unique(tenant_id,id));
      create table public.administrations(tenant_id uuid,hr_group_id uuid,id uuid,is_active boolean,unique(tenant_id,hr_group_id,id));
      create table public.holiday_calendars(id uuid,tenant_id uuid,hr_group_id uuid,country_code text);
      create table public.holidays(id uuid,tenant_id uuid,hr_group_id uuid,holiday_calendar_id uuid,holiday_date date,display_name text,provider_name text,is_active boolean);
      create table public.audit_logs(id uuid default gen_random_uuid(),tenant_id uuid,administration_id uuid,entity_name text,entity_id uuid,actor_user_id uuid,action text,changes jsonb,correlation_id uuid);
      create table public.process_instances(tenant_id uuid,hr_group_id uuid,id uuid,process_definition_id uuid,process_version_id uuid,administration_id uuid,correlation_id uuid);
      create table public.process_versions(tenant_id uuid,hr_group_id uuid,process_definition_id uuid,id uuid,definition_json jsonb);
      create table public.process_step_instances(id uuid primary key default gen_random_uuid(),tenant_id uuid,hr_group_id uuid,process_instance_id uuid,process_version_id uuid,step_key text,status public.process_step_instance_status,activated_at timestamptz,deadline_at timestamptz);
      create table public.process_work_items(id uuid default gen_random_uuid(),tenant_id uuid,hr_group_id uuid,process_instance_id uuid,step_instance_id uuid,process_version_id uuid,step_key text,deadline_at timestamptz);
      create function internal_security.current_user_has_hr_group_permission(t uuid,g uuid,p text) returns boolean language sql stable security definer set search_path='' as $$ select auth.uid()='${admin}'::uuid and t='${tenant}'::uuid and g='${group}'::uuid and p='process-definition:write' $$;
      create function internal_security.has_administration_access(t uuid,a uuid) returns boolean language sql stable security definer set search_path='' as $$ select auth.uid()='${admin}'::uuid and t='${tenant}'::uuid and a='${administration}'::uuid $$;
      create function internal_security.process_scope_has_permission(t uuid,g uuid,s public.access_scope_type,a uuid,p text) returns boolean language sql stable security definer set search_path='' as $$ select internal_security.current_user_has_hr_group_permission(t,g,p) and internal_security.has_administration_access(t,a) $$;
      grant usage on schema public,auth,internal_security to authenticated;
      ${fn(p4,'process_definition_content')}
      ${fn(p7,'process_deadline_at')}
      ${fn(p7,'set_process_step_deadline')}
      create trigger process_step_deadline_before before insert or update of status,activated_at,step_key,process_version_id on public.process_step_instances for each row execute function internal_security.set_process_step_deadline();
      ${fn(sla,'materialize_process_step_deadline')}
      create trigger process_step_instances_materialize_deadline before insert on public.process_step_instances for each row execute function internal_security.materialize_process_step_deadline();
      ${fn(sla,'copy_process_step_deadline_to_work_item')}
      create trigger process_work_items_copy_step_deadline before insert on public.process_work_items for each row execute function internal_security.copy_process_step_deadline_to_work_item();
      insert into auth.users values('${admin}'),('${manager}'),('${employee}');
      insert into public.hr_groups values('${tenant}','${group}',true,'Europe/Amsterdam'),('${tenant}','${foreignGroup}',true,'Europe/Amsterdam');
      insert into public.administrations values('${tenant}','${group}','${administration}',true),('${tenant}','${foreignGroup}','${foreignAdministration}',true);
    `)
    await db.exec(migration)
  }, 30000)
  afterAll(async () => { await db?.close() })
  beforeEach(async () => {
    await db.exec('reset role; truncate public.work_calendar_exceptions,public.work_calendar_versions,public.work_calendars,public.process_step_instances,public.process_work_items,public.process_instances,public.process_versions,public.audit_logs,public.holidays,public.holiday_calendars;')
    await db.query("update public.hr_groups set time_zone='Europe/Amsterdam' where id=$1",[group])
    await db.query('insert into public.process_instances values($1,$2,$3,$4,$5,$6,$7)', [tenant,group,instance,definition,processVersion,administration,id(12)])
    await db.query("insert into public.process_versions values($1,$2,$3,$4,'{}')", [tenant,group,definition,processVersion])
    await db.query('insert into public.holiday_calendars values($1,$2,$3,$4)', [id(20),tenant,group,'NL'])
    for (const [n,date,label] of [[21,'2026-12-25','Eerste kerstdag'],[22,'2027-01-01','Nieuwjaarsdag'],[23,'2026-04-03','Goede Vrijdag']] as const) {
      await db.query('insert into public.holidays values($1,$2,$3,$4,$5,$6,$6,true)', [id(n),tenant,group,id(20),date,label])
    }
    await actor()
  })

  it.each([
    ['maandag','2026-10-19T09:00','2026-10-21T07:00:00.000Z'],
    ['vrijdag en wintertijd','2026-10-23T09:00','2026-10-27T08:00:00.000Z'],
    ['zaterdag en wintertijd','2026-10-24T09:00','2026-10-27T08:00:00.000Z'],
    ['zomertijd','2026-03-27T09:00','2026-03-31T07:00:00.000Z'],
  ])('calculates two working days from %s', async (_label,local,expected) => {
    const v = await publish()
    expect(new Date((await preview(v.versionId,local)).deadlineAt).toISOString()).toBe(expected)
  })

  it('uses selected source holidays and consecutive closing days', async () => {
    const v = await publish({ holidayIds: [id(21)], exceptions: [{ date: '2026-12-28', isWorkday: false, label: 'Sluiting' },{ date: '2026-12-29', isWorkday: false, label: 'Sluiting' }] })
    const result = await preview(v.versionId,'2026-12-24T09:00')
    expect(result.countedDates).toEqual(['2026-12-30','2026-12-31'])
    expect(result.skippedDates).toEqual(['2026-12-25','2026-12-26','2026-12-27','2026-12-28','2026-12-29'])
  })

  it('requires an explicit holiday choice and crosses a year boundary', async () => {
    const v = await publish({ holidayIds: [id(22)] })
    expect((await preview(v.versionId,'2026-12-31T09:00')).countedDates).toEqual(['2027-01-04','2027-01-05'])
    expect((await preview(v.versionId,'2026-04-02T09:00',1)).countedDates).toEqual(['2026-04-03'])
    await expect(publish({ holidaySelectionConfirmed: false },1)).rejects.toThrow('WORK_CALENDAR_INPUT_INVALID')
  })

  it('validates direct RPC input types without relying on the HTTP schema',async()=>{
    for(const patch of [{name:42},{reason:false},{validFrom:'today'},{exceptions:[{date:'today',isWorkday:false,label:'Sluiting'}]}]) {
      await expect(publish(patch)).rejects.toThrow('WORK_CALENDAR_INPUT_INVALID')
    }
  })

  it('supports an explicitly opened Saturday', async () => {
    const v = await publish({ exceptions: [{ date: '2026-10-24', isWorkday: true, label: 'Open zaterdag' }] })
    expect((await preview(v.versionId,'2026-10-23T09:00')).countedDates).toEqual(['2026-10-24','2026-10-26'])
  })

  it.each([['2026-03-28T02:30','2026-03-29T01:30:00.000Z'],['2026-10-24T02:30','2026-10-25T01:30:00.000Z']])('uses the established PostgreSQL gap/overlap rule from %s',async(local,expected)=>{
    const v=await publish({weekdays:[1,2,3,4,5,6,7]})
    expect(new Date((await preview(v.versionId,local,1)).deadlineAt).toISOString()).toBe(expected)
  })

  it('fails closed for a missing calendar, invalid configuration and expired administration override', async () => {
    await expect(activate('2026-10-24T07:00:00Z')).rejects.toThrow('SLA_WORKDAY_CALENDAR_REQUIRED')
    await actor()
    await expect(publish({ weekdays: [] })).rejects.toThrow('WORK_CALENDAR_INPUT_INVALID')
    await publish({},0,null)
    await publish({ validUntil: '2026-09-30' })
    await expect(activate('2026-10-24T07:00:00Z')).rejects.toThrow('SLA_WORKDAY_CALENDAR_OUT_OF_RANGE')
  })

  it('rejects invalid time zones and a deadline beyond the explicit coverage', async () => {
    const v=await publish({validUntil:'2026-12-31'})
    await expect(preview(v.versionId,'2026-12-31T09:00')).rejects.toThrow('SLA_WORKDAY_CALENDAR_OUT_OF_RANGE')
    await db.exec('reset role;')
    await db.query("update public.hr_groups set time_zone='Invalid/Zone' where id=$1",[group])
    await actor()
    await expect(publish({},1)).rejects.toThrow('SLA_TIME_ZONE_NOT_CONFIGURED')
  })

  it('keeps published holiday snapshots unchanged when the source register changes', async () => {
    const v=await publish({holidayIds:[id(21)]})
    const before=await preview(v.versionId,'2026-12-24T09:00')
    await db.exec('reset role;')
    await db.query('delete from public.holidays where id=$1',[id(21)])
    await actor()
    expect(await preview(v.versionId,'2026-12-24T09:00')).toEqual(before)
  })

  it('copies the materialized deadline exactly to the existing work-item path',async()=>{
    const v=await publish()
    const step=await activate('2026-10-24T07:00:00Z')
    const item=(await db.query<{deadline_at:Date}>(`insert into public.process_work_items(tenant_id,hr_group_id,process_instance_id,step_instance_id,process_version_id,step_key) values($1,$2,$3,$4,$5,'request') returning deadline_at`,[tenant,group,instance,step.id,processVersion])).rows[0]
    expect(item.deadline_at).toEqual(step.deadline_at)
    expect(step.work_calendar_version_id).toBe(v.versionId)
  })

  it('verifies database types against schema introspection and keeps RLS/private helpers closed',async()=>{
    const types=readFileSync(new URL('../../../../packages/db/types.ts',import.meta.url),'utf8')
    for(const table of ['work_calendars','work_calendar_versions','work_calendar_exceptions']) {
      const start=types.indexOf(`      ${table}: {`)
      expect(start).toBeGreaterThan(0)
      const row=types.slice(start,types.indexOf('        Insert:',start))
      const columns=await db.query<{column_name:string;is_nullable:string;data_type:string}>('select column_name,is_nullable,data_type from information_schema.columns where table_schema=\'public\' and table_name=$1',[table])
      for(const column of columns.rows) {
        const scalar=column.data_type==='ARRAY'?'number[]':['integer','smallint'].includes(column.data_type)?'number':column.data_type==='boolean'?'boolean':'string'
        expect(row).toContain(`${column.column_name}: ${scalar}${column.is_nullable==='YES'?' | null':''}`)
      }
      const fullBlock=types.slice(start,types.indexOf('\n      }',start)+8)
      const foreignKeys=await db.query<{conname:string}>(`select c.conname from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_class r on r.oid=c.confrelid join pg_namespace n on n.oid=r.relnamespace where c.contype='f' and t.relname=$1 and n.nspname='public'`,[table])
      for(const key of foreignKeys.rows) expect(fullBlock).toContain(key.conname)
    }
    const rls=(await db.query<{relrowsecurity:boolean}>("select relrowsecurity from pg_class where relname in ('work_calendars','work_calendar_versions','work_calendar_exceptions')")).rows
    expect(rls).toHaveLength(3);expect(rls.every(row=>row.relrowsecurity)).toBe(true)
    const rights=(await db.query<{anon:boolean;helper:boolean}>("select has_function_privilege('anon','public.publish_work_calendar(uuid,uuid,jsonb,integer)','EXECUTE') as anon,has_function_privilege('authenticated','internal_security.work_calendar_deadline(uuid,timestamptz,integer)','EXECUTE') as helper")).rows[0]
    expect(rights).toEqual({anon:false,helper:false})
    const privateRights=await db.query<{allowed:boolean}>("select has_function_privilege('authenticated',p.oid,'EXECUTE') as allowed from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='internal_security' and p.proname in ('guard_work_calendar_version','require_work_calendar_admin','work_calendar_deadline','resolve_process_work_calendar','guard_process_work_deadline','audit_process_work_deadline')")
    expect(privateRights.rows).toHaveLength(6);expect(privateRights.rows.every(row=>!row.allowed)).toBe(true)
    for(const table of ['work_calendars','work_calendar_versions','work_calendar_exceptions']) {
      expect((await db.query<{write:boolean}>("select has_table_privilege('authenticated',$1,'INSERT,UPDATE,DELETE') as write",[`public.${table}`])).rows[0].write).toBe(false)
    }
  })

  it.each([manager,employee])('denies management, preview and RLS reads to an ordinary persona %s', async user => {
    const v = await publish({holidayIds:[id(21)]})
    await actor(user)
    await expect(publish()).rejects.toThrow('WORK_CALENDAR_FORBIDDEN')
    await expect(db.query('select public.get_work_calendars($1,$2)',[group,administration])).rejects.toThrow('WORK_CALENDAR_FORBIDDEN')
    await expect(preview(v.versionId,'2026-10-24T09:00')).rejects.toThrow('WORK_CALENDAR_FORBIDDEN')
    expect((await db.query('select * from public.work_calendars')).rows).toHaveLength(0)
    expect((await db.query('select * from public.work_calendar_versions')).rows).toHaveLength(0)
    expect((await db.query('select * from public.work_calendar_exceptions')).rows).toHaveLength(0)
    await expect(db.query('update public.work_calendars set current_revision=9')).rejects.toThrow(/permission denied/)
  })

  it('denies forged group, administration and holiday scope even for HR Admin', async () => {
    await expect(db.query('select public.get_work_calendars($1,$2)',[foreignGroup,foreignAdministration])).rejects.toThrow('WORK_CALENDAR_FORBIDDEN')
    await expect(publish({},0,foreignAdministration)).rejects.toThrow('WORK_CALENDAR_FORBIDDEN')
    await expect(publish({ holidayIds: [id(99)] })).rejects.toThrow('WORK_CALENDAR_HOLIDAY_OUT_OF_SCOPE')
    expect((await db.query('select * from public.work_calendar_versions')).rows).toHaveLength(0)
  })

  it('pins immutable calendar revisions and deadlines while later activations use a new publication', async () => {
    const first = await publish()
    const old = await activate('2026-10-23T07:00:00Z')
    await actor()
    const second = await publish({ exceptions: [{ date: '2026-10-26', isWorkday: false, label: 'Sluiting' }] },1)
    await expect(publish({},1)).rejects.toThrow('WORK_CALENDAR_STALE')
    await db.exec('reset role;')
    await db.query("update public.process_step_instances set status='COMPLETED' where id=$1",[old.id])
    const saved = (await db.query<{deadline_at: Date;work_calendar_version_id:string}>('select deadline_at,work_calendar_version_id from public.process_step_instances where id=$1',[old.id])).rows[0]
    expect(saved.deadline_at).toEqual(old.deadline_at)
    expect(saved.work_calendar_version_id).toBe(first.versionId)
    const next = await activate('2026-10-23T07:00:00Z')
    expect(next.work_calendar_version_id).toBe(second.versionId)
    expect(next.deadline_at.toISOString()).toBe('2026-10-28T08:00:00.000Z')
    await expect(db.query('update public.process_step_instances set deadline_at=now() where id=$1',[old.id])).rejects.toThrow('PROCESS_DEADLINE_IMMUTABLE')
    await expect(db.query("update public.work_calendar_versions set name='Changed' where id=$1",[first.versionId])).rejects.toThrow('WORK_CALENDAR_VERSION_IMMUTABLE')
    expect((await db.query("select * from public.audit_logs where changes->>'runtimeAction'='PROCESS_WORKDAY_DEADLINE_SET'")).rows).toHaveLength(2)
  })

  it.each([['HOURS',2,'2026-03-28T11:00:00.000Z'],['DAYS',1,'2026-03-29T08:00:00.000Z']])('preserves ordinary %s deadlines without a calendar', async (unit,amount,expected) => {
    const row = await activate('2026-03-28T09:00:00Z',false,unit,Number(amount))
    expect(row.deadline_at.toISOString()).toBe(expected)
    expect(row.work_calendar_version_id).toBeNull()
  })
})
