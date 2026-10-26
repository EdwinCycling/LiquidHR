import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Uitvoerbaar PostgreSQL-contract met begrensde bestaande-kernelinterfaces.
// Geen live persona-/PMUX-kernelacceptatie: de bestaande permissiehelpers en
// start/claim/act-kernel worden hier door kleine contractdoubles vertegenwoordigd.
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const tenant=id(1), group=id(2), admin=id(3), hr=id(4), manager=id(5), self=id(6), stranger=id(7), employee=id(8), other=id(9), caseId=id(10), definition=id(11)
let db: PGlite
async function actor(user: string) { await db.query("select set_config('test.actor',$1,false)", [user]) }
async function command(input: Record<string, unknown>) {
  return (await db.query<{ id: string }>('select public.wvp_command($1,$2,$3,$4::jsonb) id', [tenant,group,admin,JSON.stringify({caseId,...input})])).rows[0].id
}
async function list(user: string, target?: string) {
  await actor(user)
  return (await db.query<{ data: Array<{ id: string; tasks: Array<{ id: string; code: string; dueOn: string }>; events: unknown[] }> }>('select public.wvp_list($1,$2,$3,$4) data',[tenant,group,admin,target??null])).rows[0].data
}
describe('WVP01 uitvoerbaar databasecontract', () => {
  beforeAll(async () => {
    db=new PGlite()
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth; create schema internal_security;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.actor',true),'')::uuid $$;
      create table public.hr_groups(tenant_id uuid,id uuid primary key,time_zone text,unique(tenant_id,id));
      create table public.administrations(tenant_id uuid,hr_group_id uuid,id uuid primary key,unique(tenant_id,hr_group_id,id));
      create table public.employees(id uuid primary key,first_name text,birth_name text);
      create table public.absence_cases(id uuid primary key,tenant_id uuid,hr_group_id uuid,administration_id uuid,employee_id uuid,employment_id uuid,status text,pending_confirmation boolean default false,archived_at timestamptz,first_absence_on date,effective_clock_start_on date,unique(tenant_id,hr_group_id,id));
      create table public.absence_spells(id uuid primary key,case_id uuid,started_on date,recovered_on date);
      create table public.absence_capacity_changes(spell_id uuid,effective_on date,absence_percentage numeric,expected_next_review_on date);
      create table public.absence_tasks(id uuid primary key default gen_random_uuid(),tenant_id uuid,hr_group_id uuid,case_id uuid,milestone_code text,milestone_type text,due_on date,status text default 'OPEN',human_confirmation_required boolean,source_version text,completed_at timestamptz,completed_by_user_id uuid,completion_note text,unique(tenant_id,hr_group_id,case_id,milestone_code));
      create table public.process_definitions(id uuid primary key,tenant_id uuid,hr_group_id uuid,administration_id uuid,key text,status text);
      create table public.process_versions(id uuid,process_definition_id uuid,definition_json jsonb);
      create table public.process_instances(id uuid primary key,tenant_id uuid,hr_group_id uuid,status text,idempotency_key text,process_definition_id uuid,unique(tenant_id,hr_group_id,id));
      create table public.process_step_instances(id uuid primary key default gen_random_uuid(),process_instance_id uuid,status text,step_key text,deadline_at timestamptz);
      create table public.process_work_items(id uuid primary key default gen_random_uuid(),process_instance_id uuid,step_instance_id uuid,status text,step_key text,deadline_at timestamptz,expected_version bigint default 1);
      create function internal_security.has_hr_group_access(uuid,uuid) returns boolean language sql stable as $$ select auth.uid() in ('${hr}','${manager}','${self}','${stranger}') and $1='${tenant}' and $2='${group}' $$;
      create function internal_security.current_employee_id(uuid,uuid) returns uuid language sql stable as $$ select case when auth.uid()='${self}' then '${employee}'::uuid when auth.uid()='${stranger}' then '${other}'::uuid else null end $$;
      create function internal_security.current_employee_has_permission(text) returns boolean language sql stable as $$ select $1='self:absence:read' $$;
      create function internal_security.current_employee_is_preboarding(uuid,uuid) returns boolean language sql stable as $$ select coalesce(current_setting('test.preboarding',true),'false')='true' $$;
      create function internal_security.can_manage_employee(uuid,text) returns boolean language sql stable as $$ select auth.uid()='${hr}' or (auth.uid()='${manager}' and $1='${employee}') $$;
      create function internal_security.process_scope_has_permission(uuid,uuid,text,uuid,text) returns boolean language sql stable as $$ select $1='${tenant}' and $2='${group}' and $4='${admin}' and auth.uid() in ('${hr}','${manager}') $$;
      create table public.audit_logs(
        id uuid primary key default gen_random_uuid(),tenant_id uuid not null,administration_id uuid,
        entity_name text not null,entity_id uuid not null,actor_user_id uuid,action text not null,
        changes jsonb not null,created_at timestamptz not null default now()
      );
      create function internal_security.audit_hr_change() returns trigger language plpgsql as $$
        declare audit_entity_id uuid; begin
          if tg_op='DELETE' then audit_entity_id:=old.id; else audit_entity_id:=new.id; end if;
          return new;
        end $$;
      create table public.process_work_item_notes(id uuid,work_item_id uuid,body text);
      create function public.start_process(uuid,uuid,uuid,date,text,uuid) returns jsonb language plpgsql as $$ declare i uuid:=gen_random_uuid();s uuid; begin
        insert into public.process_instances values(i,'${tenant}','${group}','RUNNING',$5,$1);
        insert into public.process_step_instances(process_instance_id,status,step_key) values(i,'ACTIVE','wvp-week-6') returning id into s;
        insert into public.process_work_items(process_instance_id,step_instance_id,status,step_key,deadline_at) select i,s,'OPEN','wvp-week-6',deadline_at from public.process_step_instances where id=s;
        return jsonb_build_object('processInstanceId',i); end $$;
      create function public.claim_process_work_item(uuid,bigint) returns jsonb language plpgsql as $$ begin update public.process_work_items set status='CLAIMED',expected_version=expected_version+1 where id=$1; return '{}'::jsonb; end $$;
      create function public.perform_process_work_item_action(uuid,text,bigint,bigint,text,uuid) returns jsonb language plpgsql as $$ declare i uuid; s uuid; next_key text; begin
        select process_instance_id into i from public.process_work_items where id=$1;
        if $2='CANCEL' then update public.process_instances set status='COMPLETED' where id=(select process_instance_id from public.process_work_items where id=$1); end if;
        update public.process_step_instances set status=case when $2='CANCEL' then 'CANCELLED' else 'COMPLETED' end where id=(select step_instance_id from public.process_work_items where id=$1);
        update public.process_work_items set status='COMPLETED' where id=$1;
        if $2<>'CANCEL' then
          select lower(replace(t.milestone_code,'_','-')) into next_key from public.absence_tasks t join public.absence_guidance a on a.case_id=t.case_id where a.process_instance_id=i and t.status='OPEN' order by t.due_on,t.milestone_code limit 1;
          next_key:=coalesce(next_key,'guidance');
          insert into public.process_step_instances(process_instance_id,status,step_key) values(i,'ACTIVE',next_key) returning id into s;
          insert into public.process_work_items(process_instance_id,step_instance_id,status,step_key,deadline_at) select i,s,'OPEN',next_key,deadline_at from public.process_step_instances where id=s;
        end if;
        return '{}'::jsonb; end $$;
      insert into auth.users values('${hr}'),('${manager}'),('${self}'),('${stranger}');
      insert into public.hr_groups values('${tenant}','${group}','Europe/Amsterdam');
      insert into public.administrations values('${tenant}','${group}','${admin}');
      insert into public.employees values('${employee}','Test','Medewerker'),('${other}','Andere','Medewerker');
      insert into public.absence_cases values('${caseId}','${tenant}','${group}','${admin}','${employee}','${id(12)}','ACTIVE',false,null,current_date-100,current_date-100);
      insert into public.absence_cases values('${id(20)}','${tenant}','${group}','${admin}','${other}','${id(21)}','ACTIVE',false,null,current_date-50,current_date-50);
      insert into public.process_definitions values('${definition}','${tenant}','${group}','${admin}','wvp01-${admin.replaceAll('-','')}','PUBLISHED');
    `)
    await db.exec(readFileSync(new URL('./20261026055349_wvp01_absence_guidance.sql', import.meta.url),'utf8'))
  },30000)
  afterAll(async () => { await db?.close() })
  it('HR ziet beide cases, manager alleen team, employee alleen zichzelf',async () => {
    expect(await list(hr)).toHaveLength(2)
    expect((await list(manager)).map(c=>c.id)).toEqual([caseId])
    expect((await list(self)).map(c=>c.id)).toEqual([caseId])
    expect(await list(self,id(20))).toEqual([])
    expect(await list(stranger,caseId)).toEqual([])
  })
  it('weigert employee-start en een manager buiten het team',async () => {
    await actor(self); await expect(command({action:'START',processDefinitionId:definition})).rejects.toThrow('WVP_FORBIDDEN')
    await actor(manager); await expect(command({action:'START',caseId:id(20),processDefinitionId:definition})).rejects.toThrow('WVP_FORBIDDEN')
  })
  it('blokkeert een generieke processtart zonder transactionele verzuimkoppeling',async () => {
    await actor(hr); await db.exec('begin;')
    try { await expect(db.query('select public.start_process($1,$2,$3,current_date,$4,null)',[definition,employee,id(12),`wvp01:${caseId}`])).rejects.toThrow('WVP_CASE_LINK_REQUIRED') }
    finally { await db.exec('rollback;') }
  })
  it('geeft preboarding geen reguliere eigen verzuimtoegang',async () => {
    await actor(self); await db.exec("select set_config('test.preboarding','true',false)")
    expect(await list(self,caseId)).toEqual([])
    await db.exec("select set_config('test.preboarding','false',false)")
  })
  it('weigert andere tenant, groep en administratie in directe RPC-aanroep',async () => {
    await actor(hr)
    for (const args of [[id(90),group,admin],[tenant,id(90),admin],[tenant,group,id(90)]]) await expect(db.query('select public.wvp_command($1,$2,$3,$4::jsonb)',[...args,JSON.stringify({action:'START',caseId,processDefinitionId:definition})])).rejects.toThrow('WVP_FORBIDDEN')
  })
  it('reproduceert SQLSTATE 42703 transactioneel en rolt de mislukte processtart terug',async () => {
    await actor(hr)
    await db.exec('begin;')
    try {
      await db.exec(`do $$
        declare failed_state text;
        begin
          begin
            perform public.wvp_command('${tenant}'::uuid,'${group}'::uuid,'${admin}'::uuid,
              jsonb_build_object('caseId','${caseId}','action','START','processDefinitionId','${definition}'));
          exception when others then
            get stacked diagnostics failed_state = returned_sqlstate;
          end;
          if failed_state is distinct from '42703' then
            raise exception 'Expected audit SQLSTATE 42703, received %', failed_state;
          end if;
          perform set_config('test.audit_failure_sqlstate',failed_state,false);
        end $$;`)
      expect((await db.query<{ value:string }>("select current_setting('test.audit_failure_sqlstate') value")).rows[0].value).toBe('42703')
      expect((await db.query('select * from public.absence_guidance')).rows).toHaveLength(0)
      expect((await db.query('select * from public.audit_logs')).rows).toHaveLength(0)
    } finally {
      await db.exec('rollback;')
    }
  })
  it('bindt uitsluitend de WVP-audittriggers aan de casesleutelhelper',async () => {
    await db.exec(readFileSync(new URL('./20261026172808_wvp01_guidance_audit_case_id.sql',import.meta.url),'utf8'))
    const triggers=await db.query<{tgname:string; proname:string}>(`select trigger.tgname, procedure.proname
      from pg_trigger trigger join pg_proc procedure on procedure.oid=trigger.tgfoid
      where trigger.tgrelid in ('public.absence_guidance'::regclass,'public.absence_guidance_events'::regclass)
        and not trigger.tgisinternal and trigger.tgname like 'audit_absence_guidance%' order by trigger.tgname`)
    expect(triggers.rows).toEqual([
      {tgname:'audit_absence_guidance',proname:'audit_wvp_guidance_change'},
      {tgname:'audit_absence_guidance_events',proname:'audit_wvp_guidance_change'}
    ])
    expect((await db.query<{allowed:boolean}>("select has_function_privilege('authenticated','internal_security.audit_wvp_guidance_change()','EXECUTE') allowed")).rows[0].allowed).toBe(false)
    expect((await db.query<{relrowsecurity:boolean}>("select relrowsecurity from pg_class where relname in ('absence_guidance','absence_guidance_events')")).rows.every(r=>r.relrowsecurity)).toBe(true)
  })
  it('start eenmaal, ook bij tweede actor en herhaalde aanvraag',async () => {
    await actor(hr); const first=await command({action:'START',processDefinitionId:definition})
    await actor(manager); expect(await command({action:'START',processDefinitionId:definition})).toBe(first)
    expect((await db.query('select * from public.absence_guidance')).rows).toHaveLength(1)
    expect((await list(hr,caseId))[0].tasks).toHaveLength(22)
    expect((await db.query<{deadline_at: string}>('select deadline_at from public.process_work_items')).rows[0].deadline_at).toBeTruthy()
    const eventId=(await db.query<{id:string}>("select id from public.absence_guidance_events where event_type='STARTED'")).rows[0].id
    const audits=await db.query<{entity_name:string; entity_id:string; administration_id:string|null; actor_user_id:string|null; action:string; changes:{before:Record<string,unknown>; after:Record<string,unknown>}}>(
      'select entity_name,entity_id,administration_id,actor_user_id,action,changes from public.audit_logs order by created_at,id')
    const guidanceAudits=audits.rows.filter(entry=>entry.entity_name==='absence_guidance')
    expect(guidanceAudits.map(entry=>entry.action).sort()).toEqual(['CREATE','UPDATE'])
    for(const entry of guidanceAudits){ expect(entry.entity_id).toBe(caseId); expect(entry.administration_id).toBe(admin); expect(entry.actor_user_id).toBe(hr) }
    const created=guidanceAudits.find(entry=>entry.action==='CREATE')!
    const updated=guidanceAudits.find(entry=>entry.action==='UPDATE')!
    expect(created.changes.after.case_id).toBe(caseId)
    expect(updated.changes.after.process_instance_id).toBe(first)
    expect(updated.changes.before.process_instance_id).not.toBe(first)
    const eventAudit=audits.rows.find(entry=>entry.entity_name==='absence_guidance_event')!
    expect(eventAudit.action).toBe('CREATE')
    expect(eventAudit.entity_id).toBe(eventId)
    expect(eventAudit.administration_id).toBe(admin)
    expect(eventAudit.actor_user_id).toBe(hr)
    expect(eventAudit.changes.after.case_id).toBe(caseId)
    expect(JSON.stringify(audits.rows)).not.toMatch(/diagnosis|treatment|medical|cause/i)
    expect(audits.rows).toHaveLength(3)
  })
  it('weigert vrije tekst op RPC- en tabelniveau',async () => {
    await actor(hr)
    await expect(command({action:'AGREEMENT',diagnosis:'niet opslaan',idempotencyKey:id(50)})).rejects.toThrow('WVP_INVALID_INPUT')
    await expect(db.query("update public.absence_tasks set completion_note='niet opslaan' where case_id=$1",[caseId])).rejects.toThrow('WVP_FREE_TEXT_FORBIDDEN')
  })
  it('houdt gebeurtenisdatum, bewijsbevestiging en idempotentie vast',async () => {
    const task=(await list(hr,caseId))[0].tasks.find(t=>t.code==='WVP_WEEK_6')!
    const today=(await db.query<{ date_value: string }>("select current_date::text date_value")).rows[0].date_value
    const input={action:'MILESTONE',taskId:task.id,occurredOn:today,confirmed:true,idempotencyKey:id(51)}
    const first=await command(input); expect(await command(input)).toBe(first)
    await expect(command({...input,occurredOn:'2020-01-01'})).rejects.toThrow('WVP_IDEMPOTENCY_CONFLICT')
    expect((await list(hr,caseId))[0].events).toHaveLength(2)
  })
  it('registreert niet-medische werkafspraak en self-only kennisname',async () => {
    const today=(await db.query<{date_value:string}>('select current_date::text date_value')).rows[0].date_value
    await actor(manager)
    const agreementId=await command({action:'AGREEMENT',agreement:'GRADUAL_BUILDUP',occurredOn:today,reviewOn:today,idempotencyKey:id(52)})
    await expect(command({action:'ACKNOWLEDGE',agreementId,idempotencyKey:id(53)})).rejects.toThrow('WVP_FORBIDDEN')
    await actor(self); await command({action:'ACKNOWLEDGE',agreementId,idempotencyKey:id(54)})
    await actor(stranger); await expect(command({action:'ACKNOWLEDGE',agreementId,idempotencyKey:id(55)})).rejects.toThrow('WVP_FORBIDDEN')
  })
  it('weigert afsluiting tijdens ziekte en herstelvenster, ook via generieke PMUX-route',async () => {
    await actor(hr)
    await expect(command({action:'CLOSE',idempotencyKey:id(56)})).rejects.toThrow('WVP_RECOVERY_WINDOW_OPEN')
    await expect(db.exec("update public.process_instances set status='COMPLETED'")).rejects.toThrow('WVP_RECOVERY_WINDOW_OPEN')
    await db.query("update public.absence_cases set status='RECOVERY_WINDOW' where id=$1",[caseId])
    await expect(command({action:'CLOSE',idempotencyKey:id(56)})).rejects.toThrow('WVP_RECOVERY_WINDOW_OPEN')
  })
  it('behoudt afgeronde deadlines bij verandering van de casusklok',async () => {
    const before=(await list(hr,caseId))[0].tasks.find(t=>t.code==='WVP_WEEK_6')!
    await db.query('update public.absence_cases set effective_clock_start_on=effective_clock_start_on+3 where id=$1',[caseId])
    expect((await list(hr,caseId))[0].tasks.find(t=>t.code==='WVP_WEEK_6')?.dueOn).toBe(before.dueOn)
    await expect(db.query("update public.absence_tasks set status='OPEN' where id=$1",[before.id])).rejects.toThrow('WVP_HISTORY_IMMUTABLE')
  })
  it('dwingt RLS en geen directe writes af voor authenticated en anon',async () => {
    expect((await db.query<{relrowsecurity:boolean}>("select relrowsecurity from pg_class where relname in ('absence_guidance','absence_guidance_events')")).rows.every(r=>r.relrowsecurity)).toBe(true)
    for (const role of ['authenticated','anon']) for (const table of ['absence_guidance','absence_guidance_events']) for (const op of ['INSERT','UPDATE','DELETE']) {
      expect((await db.query<{allowed:boolean}>('select has_table_privilege($1,$2,$3) allowed',[role,table,op])).rows[0].allowed).toBe(false)
    }
  })
  it('houdt de voorbereide databasetypes in lijn met de nieuwe publieke relaties en RPCs',async () => {
    const types=readFileSync(new URL('../../../../packages/db/types.ts',import.meta.url),'utf8')
    const relations=await db.query<{conname:string}>("select conname from pg_constraint where conrelid in ('public.absence_guidance'::regclass,'public.absence_guidance_events'::regclass) and contype='f' and confrelid<>'auth.users'::regclass")
    for (const relation of relations.rows) expect(types).toContain(relation.conname)
    for (const name of ['wvp_list','wvp_command','wvp_case_for_process']) expect(types).toContain(`${name}:`)
  })
  it('beschermt append-only gebeurtenissen en algemene procesnotities',async () => {
    await expect(db.exec("update public.absence_guidance_events set occurred_on=current_date")).rejects.toThrow('WVP_HISTORY_IMMUTABLE')
    await expect(db.exec("delete from public.absence_guidance_events")).rejects.toThrow('WVP_HISTORY_IMMUTABLE')
    await expect(db.exec("insert into public.process_work_item_notes select gen_random_uuid(),id,'niet opslaan' from public.process_work_items limit 1")).rejects.toThrow('WVP_FREE_TEXT_FORBIDDEN')
  })
  it('weigert medische vrije tekst bij publicatie van een gewijzigde WVP-procesversie',async () => {
    await expect(db.query('insert into public.process_versions values($1,$2,$3::jsonb)',[id(80),definition,JSON.stringify({content:{forms:[{sections:[{fields:[{type:'LONG_TEXT'}]}]}]}})])).rejects.toThrow('WVP_FREE_TEXT_FORBIDDEN')
  })
  it('weigert ook extra medische ja/nee-vragen in procesformulieren',async () => {
    await expect(db.query('insert into public.process_versions values($1,$2,$3::jsonb)',[id(85),definition,JSON.stringify({content:{forms:[{sections:[{fields:[{key:'diagnosis',type:'BOOLEAN',binding:{kind:'PROCESS_ONLY'}}]}]}]}})])).rejects.toThrow('WVP_FREE_TEXT_FORBIDDEN')
  })
  it('leest de nieuwe tabellen als authenticated onder de werkelijke RLS-policy',async () => {
    await db.exec('grant usage on schema internal_security,auth to authenticated; grant select on public.absence_cases to authenticated;')
    await actor(self); await db.exec('set role authenticated;')
    expect((await db.query('select * from public.absence_guidance')).rows).toHaveLength(1)
    await db.exec('reset role;'); await actor(stranger); await db.exec('set role authenticated;')
    expect((await db.query('select * from public.absence_guidance')).rows).toHaveLength(0)
    expect((await db.query('select * from public.absence_guidance_events')).rows).toHaveLength(0)
    await expect(db.exec('delete from public.absence_guidance')).rejects.toThrow('permission denied')
    await db.exec('reset role;')
  })
  it('sluit na herstel af via de bestaande kernel, bewaart historie en annuleert alleen toekomstige taken',async () => {
    await actor(hr)
    const today=(await db.query<{date_value:string}>('select current_date::text date_value')).rows[0].date_value
    await db.query("insert into public.absence_spells values($1,$2,current_date-100,current_date)",[id(81),caseId])
    await db.query("update public.absence_cases set status='CLOSED' where id=$1",[caseId])
    await expect(command({action:'CLOSE',idempotencyKey:id(82)})).rejects.toThrow('WVP_DUE_TASKS_OPEN')
    const task=(await list(hr,caseId))[0].tasks.find(t=>t.code==='WVP_WEEK_8')!
    await command({action:'MILESTONE',taskId:task.id,occurredOn:today,confirmed:true,idempotencyKey:id(83)})
    const first=await command({action:'CLOSE',idempotencyKey:id(82)})
    expect(await command({action:'CLOSE',idempotencyKey:id(82)})).toBe(first)
    expect((await db.query<{closed_at:Date}>('select closed_at from public.absence_guidance')).rows[0].closed_at).toBeTruthy()
    expect((await db.query<{status:string}>('select status from public.process_instances')).rows[0].status).toBe('COMPLETED')
    expect((await db.query<{status:string}>("select status from public.absence_tasks where case_id=$1 and status='OPEN'",[caseId])).rows).toHaveLength(0)
    await expect(command({action:'AGREEMENT',agreement:'UNCHANGED',occurredOn:today,reviewOn:today,idempotencyKey:id(84)})).rejects.toThrow('WVP_CLOSED')
  })
  it('hergebruikt een bestaande legacy-afronding zonder datum, actor of bron te herschrijven',async () => {
    await actor(hr)
    await db.query("insert into public.absence_cases values($1,$2,$3,$4,$5,$6,'ACTIVE',false,null,current_date-100,current_date-100)",[id(86),tenant,group,admin,other,id(87)])
    await db.query("insert into public.absence_tasks(id,tenant_id,hr_group_id,case_id,milestone_code,milestone_type,due_on,status,human_confirmation_required,source_version,completed_at,completed_by_user_id) values($1,$2,$3,$4,'WVP_WEEK_6','STATUTORY_CANDIDATE',current_date-58,'COMPLETED',true,'WVP_FOUNDATION_V1',now()-interval '55 days',$5)",[id(88),tenant,group,id(86),hr])
    const before=(await db.query('select * from public.absence_tasks where id=$1',[id(88)])).rows[0]
    await command({action:'START',caseId:id(86),processDefinitionId:definition})
    const today=(await db.query<{date_value:string}>('select current_date::text date_value')).rows[0].date_value
    const input={action:'MILESTONE',caseId:id(86),taskId:id(88),occurredOn:today,confirmed:true,idempotencyKey:id(89)}
    const first=await command(input); expect(await command(input)).toBe(first)
    expect((await db.query('select * from public.absence_tasks where id=$1',[id(88)])).rows[0]).toEqual(before)
  })
})
