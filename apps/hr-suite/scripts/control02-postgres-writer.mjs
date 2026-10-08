import { readFile, writeFile } from 'node:fs/promises'
import { randomUUID, randomBytes, createHash } from 'node:crypto'
import { join, resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const runtimeRoot = resolve(process.argv[2])
const migrationPath = resolve(process.argv[3])
const { default: EmbeddedPostgres } = await import(pathToFileURL(join(runtimeRoot, 'node_modules/embedded-postgres/dist/index.js')).href)
const db = new EmbeddedPostgres({
  databaseDir: join(runtimeRoot, 'data-' + randomUUID()), user: 'postgres',
  password: randomBytes(24).toString('hex'), port: 55438, persistent: true,
  createPostgresUser: false, postgresFlags: ['-h', '127.0.0.1'],
  onLog: () => {}, onError: () => {},
})
let client
let setupFailed = false
const results = []
const h = 'a'.repeat(64)
const contract = 'CONTROL02-CORE-PAYROLL-TEST-CANDIDATE-2'
const schema = '2.0'
const tax = '123456789L01'
const metaCache = new Map()
async function insert(table, values) {
  let columns = metaCache.get(table)
  if (!columns) {
    columns = (await client.query("select a.attname as name, a.attnotnull as required, t.typname as type, pg_get_expr(d.adbin,d.adrelid) as default_value, (select e.enumlabel from pg_enum e where e.enumtypid=t.oid order by e.enumsortorder limit 1) as enum_value from pg_attribute a join pg_type t on t.oid=a.atttypid left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=$1::regclass and a.attnum>0 and not a.attisdropped", ['public.' + table])).rows
    metaCache.set(table, columns)
  }
  const row = { ...values }
  for (const c of columns) {
    if (c.required && !c.default_value && !(c.name in row)) {
      row[c.name] = c.enum_value ?? (c.type === 'uuid' ? randomUUID() : c.type === 'jsonb' ? {} : c.type.startsWith('_') ? [] : /int|numeric/.test(c.type) ? 1 : c.type === 'bool' ? false : /timestamp/.test(c.type) ? new Date().toISOString() : c.type === 'date' ? '2026-01-01' : 'synthetic')
    }
  }
  const keys = Object.keys(row)
  const params = keys.map(k => columns.find(c => c.name === k)?.type === 'jsonb' ? JSON.stringify(row[k]) : row[k])
  return (await client.query('insert into public."' + table + '" (' + keys.map(k => '"' + k + '"').join(',') + ') values (' + keys.map((_, i) => '$' + (i + 1)).join(',') + ') returning *', params)).rows[0]
}
async function fixture({ type = 'CREATE_INCOME_RELATIONSHIP', count = 1, draft = false } = {}) {
  const f = { tenant: randomUUID(), group: randomUUID(), admin: randomUUID(), actor: randomUUID(), batch: randomUUID(), plan: randomUUID(), person: randomUUID(), employee: randomUUID(), employment: randomUUID(), decision: randomUUID(), owner: randomUUID(), token: 'b'.repeat(64), actions: [], refs: [] }
  await insert('administrations', { id:f.admin, tenant_id:f.tenant, hr_group_id:f.group, name:'CONTROL02 synthetic' })
  await insert('employees', { id:f.employee, tenant_id:f.tenant, hr_group_id:f.group, employee_number:'100023', first_name:'Synthetic', birth_name:'Writer', gender:'MALE', name_usage:'BIRTH_NAME' })
  await insert('employee_administration_assignments', { tenant_id:f.tenant, hr_group_id:f.group, administration_id:f.admin, employee_id:f.employee, effective_from:'2026-01-01' })
  if (!draft) await insert('employments', { id:f.employment, tenant_id:f.tenant, hr_group_id:f.group, administration_id:f.admin, employee_id:f.employee, employment_number:'1', employment_type:'EMPLOYEE', contract_type:'INDEFINITE', record_status:'CONFIRMED', starts_on:'2026-01-01', seniority_date:'2026-01-01', original_hire_date:'2026-01-01', is_primary:false })
  await insert('payroll_import_batches', { id:f.batch, tenant_id:f.tenant, hr_group_id:f.group, administration_id:f.admin, source_type:'LOONAANGIFTE_XML', source_hash:h, status:'STAGED', tax_year:2026, idempotency_key:randomUUID() })
  await insert('payroll_import_persons', { id:f.person, tenant_id:f.tenant, hr_group_id:f.group, batch_id:f.batch, source_row_number:1, status:'GREEN', match_status:'NEW', first_name:'Synthetic', birth_name:'Writer', validation_codes:[] })
  for (let i=1; i<=count; i++) {
    const ends = i===2 ? '2026-12-31' : null
    f.refs.push('row-1:income:' + tax + ':' + i + ':2026-01-01:' + (ends ?? ''))
    await insert('payroll_import_income_relationships', { tenant_id:f.tenant, hr_group_id:f.group, administration_id:f.admin, batch_id:f.batch, import_person_id:f.person, payroll_tax_number:tax, ikv_number:i, starts_on:'2026-01-01', ends_on:ends })
  }
  const binding = await insert('administration_payroll_tax_numbers', { tenant_id:f.tenant, hr_group_id:f.group, administration_id:f.admin, payroll_tax_number:tax, valid_from:'2025-01-01' })
  f.binding = binding.id
  await insert('payroll_import_xml_provenance', { tenant_id:f.tenant, hr_group_id:f.group, administration_id:f.admin, batch_id:f.batch, source_hash:h, schema_version:schema, namespace_uri:'http://xml.belastingdienst.nl/schemas/Loonaangifte/2026/01', source_archive_sha256:'134cf1464ccce87acff81c8c624c0ad31878a43e541babb46514926912b1836e', xsd_sha256:'eb862bea8c7232154cfb30bb37c4ecf192b4a86540944358b065bb7fa54fc441', release_page_url:'https://odb.belastingdienst.nl/documentatie/loonheffingen-aangifte-2026v09/', xsd_filename:'Loonaangifte2026v2.0.xsd' })
  const employmentChoices = Object.fromEntries(f.refs.map(ref => [ref, draft ? { action:'CREATE_DRAFT_EMPLOYMENT', confirmed:true, contractType:'INDEFINITE', startsOn:'2026-01-01', seniorityDate:'2026-01-01', originalHireDate:'2026-01-01' } : { action:'REUSE_EMPLOYMENT', confirmed:true, employmentId:f.employment }]))
  f.payload = { match:{action:'REUSE_EMPLOYEE', confirmed:true, employeeId:f.employee}, employmentByIncomeRelationship:employmentChoices, incomeRelationshipBySourceRef:Object.fromEntries(f.refs.map(ref=>[ref,{action:'CREATE',confirmed:true}])) }
  await insert('payroll_import_decisions', { id:f.decision, tenant_id:f.tenant, hr_group_id:f.group, administration_id:f.admin, batch_id:f.batch, import_person_id:f.person, confirmer_user_id:f.actor, decision_hash:h, source_hash:h, analysis_hash:h, core_state_hash:h, contract_version:contract, schema_version:schema, decision_version:1, decision_payload:f.payload })
  const expected = draft || type !== 'CREATE_INCOME_RELATIONSHIP' ? 1 : count
  await insert('payroll_import_finalization_plans', { id:f.plan, tenant_id:f.tenant, hr_group_id:f.group, administration_id:f.admin, batch_id:f.batch, status:'IN_PROGRESS', plan_hash:h, source_hash:h, analysis_hash:h, core_state_hash:h, contract_version:contract, schema_version:schema, expected_action_count:expected, completed_action_count:0 })
  for(let i=0;i<expected;i++){
    const actionId='payroll-finalize:' + randomBytes(12).toString('hex')
    f.actions.push(actionId)
    await insert('payroll_import_finalization_actions', { tenant_id:f.tenant, hr_group_id:f.group, administration_id:f.admin, batch_id:f.batch, plan_id:f.plan, import_person_id:f.person, decision_id:f.decision, action_id:actionId, idempotency_key:randomUUID(), action_type:type, sequence_no:i+1, status:'IN_PROGRESS', source_person_ref:'row-1', source_refs:draft?f.refs:type==='REUSE_EMPLOYEE'?['row-1']:[f.refs[i]], target_employee_id:f.employee, target_employment_id:draft || type==='REUSE_EMPLOYEE'?null:f.employment, target_employment_ref:draft?'draft-employment:'+f.batch+':row-1':null, source_income_ref:type==='CREATE_DRAFT_EMPLOYMENT'||type==='REUSE_EMPLOYEE'||type==='REUSE_EMPLOYMENT'?null:f.refs[i], source_payroll_tax_number:type==='CREATE_DRAFT_EMPLOYMENT'||type==='REUSE_EMPLOYEE'||type==='REUSE_EMPLOYMENT'?null:tax, source_ikv_number:type==='CREATE_DRAFT_EMPLOYMENT'||type==='REUSE_EMPLOYEE'||type==='REUSE_EMPLOYMENT'?null:i+1, source_starts_on:type==='CREATE_DRAFT_EMPLOYMENT'||type==='REUSE_EMPLOYEE'||type==='REUSE_EMPLOYMENT'?null:'2026-01-01', source_ends_on:type==='CREATE_DRAFT_EMPLOYMENT'||type==='REUSE_EMPLOYEE'||type==='REUSE_EMPLOYMENT'?null:i===1?'2026-12-31':null, draft_employment_contract_type:draft?'INDEFINITE':null, draft_employment_starts_on:draft?'2026-01-01':null, draft_employment_seniority_date:draft?'2026-01-01':null, draft_employment_original_hire_date:draft?'2026-01-01':null, plan_hash:h, decision_hash:h, source_hash:h, analysis_hash:h, core_state_hash:h, contract_version:contract, schema_version:schema, depends_on_action_ids:i>0?[f.actions[i-1]]:[], preconditions:[], checkpoint:{}, attempt_count:1, lease_owner:f.owner, lease_token_hash:f.token, lease_until:new Date(Date.now()+120000).toISOString() })
  }
  return f
}
async function versions(f) {
  const v={}
  const p=(await client.query('select id,updated_at::text as version from public.payroll_import_persons where id=$1',[f.person])).rows[0]
  v['person:'+p.id]=p.version
  const incomes=(await client.query('select *,updated_at::text as version,starts_on::text as start_text,ends_on::text as end_text from public.payroll_import_income_relationships where import_person_id=$1',[f.person])).rows
  for(const i of incomes) v['source:row-1:income:'+i.payroll_tax_number+':'+i.ikv_number+':'+i.start_text+':'+(i.end_text??'')]=i.version
  for(const [table,prefix] of [['employees','employee'],['employments','employment'],['income_relationships','income'],['administration_payroll_tax_numbers','binding']]){
    for(const row of (await client.query('select id,updated_at::text as version from public.'+table+' where tenant_id=$1',[f.tenant])).rows) v[prefix+':'+row.id]=row.version
  }
  return v
}
async function execute(f,index=0,override={}){
  const v=await versions(f)
  const material=Object.keys(v).sort().map(k=>k+'='+v[k]).join('\n')
  const token=createHash('sha256').update(material).digest('hex')
  return (await client.query('select public.execute_control02_test_payroll_finalization_action($1,$2,$3,$4,$5,$6,$7,$8,$9) as result',[f.tenant,f.group,f.batch,f.actions[index],f.actor,override.owner??f.owner,override.leaseToken??f.token,v,override.stateToken??token])).rows[0].result
}
async function event(f,type,key,options={}){
  return (await client.query('select * from public.record_payroll_import_finalization_event($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)',[f.tenant,f.group,f.batch,f.actions[0],key,type,f.actor,options.attempt??1,h,h,h,options.checkpoint??{},options.error??null,options.until??null,options.owner??null,options.token??null])).rows[0]
}
async function rejects(fn, message){
  await client.query('savepoint expected_failure')
  let error
  try { await fn() } catch(e) { error=e }
  await client.query('rollback to savepoint expected_failure')
  assert.ok(error, 'Expected PostgreSQL rejection: '+message)
  assert.equal(error.message,message)
}
async function test(name,fn){
  await client.query('begin')
  try { await fn(); results.push({name,status:'PASS'}) }
  catch(e) { results.push({name,status:'FAIL',code:e.code??null,message:e.message,where:e.where??null}) }
  finally { await client.query('rollback') }
}
try {
  await db.initialise(); await db.start(); client=db.getPgClient(); await client.connect()
  await client.query("set timezone='UTC'; create schema internal_security; create function internal_security.current_user_has_permission(uuid,uuid,text) returns boolean language sql as 'select false'")
  await client.query(await readFile(fileURLToPath(new URL('../lib/payroll-import/finalization/postgres-fixtures/schema.sql', import.meta.url)),'utf8'))
  await client.query(await readFile(migrationPath,'utf8'))
  await test('existing Employee + existing Employment + IKV create + completion + direct retry fenced',async()=>{
    const f=await fixture(); const result=await execute(f); assert.equal(result.status,'COMPLETED');assert.equal(result.planStatus,'COMPLETED')
    const count=(await client.query('select (select count(*) from public.employees) employees,(select count(*) from public.employments) employments,(select count(*) from public.income_relationships) ikvs,(select count(*) from public.employment_income_relationships) links,(select count(*) from public.payroll_import_finalization_action_events where event_type=\'COMPLETED\') events')).rows[0]
    assert.deepEqual(count,{employees:'1',employments:'1',ikvs:'1',links:'1',events:'1'})
    assert.equal((await client.query('select status from public.payroll_import_batches where id=$1',[f.batch])).rows[0].status,'COMPLETED')
    await rejects(()=>execute(f),'PAYROLL_FINALIZATION_LEASE_FENCED')
  })
  await test('two IKVs with explicit separate Employments + dependency + half-open link',async()=>{
    const f=await fixture({count:2}); const secondEmployment=randomUUID()
    await insert('employments',{id:secondEmployment,tenant_id:f.tenant,hr_group_id:f.group,administration_id:f.admin,employee_id:f.employee,employment_number:'2',employment_type:'EMPLOYEE',contract_type:'INDEFINITE',record_status:'CONFIRMED',starts_on:'2026-01-01',seniority_date:'2026-01-01',original_hire_date:'2026-01-01',is_primary:false})
    f.payload.employmentByIncomeRelationship[f.refs[1]].employmentId=secondEmployment
    await client.query('update public.payroll_import_decisions set decision_payload=$1 where id=$2',[f.payload,f.decision])
    await client.query('update public.payroll_import_finalization_actions set target_employment_id=$1 where action_id=$2',[secondEmployment,f.actions[1]])
    assert.equal((await execute(f)).planStatus,'IN_PROGRESS');assert.equal((await execute(f,1)).planStatus,'COMPLETED')
    const rows=(await client.query('select valid_until::text as valid_until from public.employment_income_relationships order by valid_until nulls first')).rows
    assert.equal(rows.length,2);assert.equal(rows[0].valid_until,null);assert.equal(rows[1].valid_until,'2027-01-01')
  })
  await test('draft Employment with explicit terms',async()=>{const f=await fixture({type:'CREATE_DRAFT_EMPLOYMENT',draft:true});assert.equal((await execute(f)).status,'COMPLETED');assert.equal((await client.query('select contract_type,record_status from public.employments')).rows[0].contract_type,'INDEFINITE')})
  await test('REUSE_EMPLOYEE',async()=>{const f=await fixture({type:'REUSE_EMPLOYEE'});assert.equal((await execute(f)).status,'COMPLETED')})
  await test('REUSE_EMPLOYMENT',async()=>{const f=await fixture({type:'REUSE_EMPLOYMENT'});assert.equal((await execute(f)).status,'COMPLETED')})
  for(const type of ['LINK_INCOME_RELATIONSHIP','NO_CHANGE']) await test(type+' existing IKV and completion',async()=>{
    const f=await fixture({type});const ir=await insert('income_relationships',{tenant_id:f.tenant,administration_id:f.admin,employee_id:f.employee,payroll_tax_number:tax,payroll_tax_subnumber:'01',payroll_tax_binding_hr_group_id:f.group,payroll_tax_binding_id:f.binding,ikv_number:1,relationship_type:'EMPLOYMENT',starts_on:'2026-01-01',reporting_status:'DRAFT'})
    f.payload.incomeRelationshipBySourceRef[f.refs[0]]={action:type==='NO_CHANGE'?'NO_CHANGE':'LINK',confirmed:true,incomeRelationshipId:ir.id}
    await client.query('update public.payroll_import_decisions set decision_payload=$1 where id=$2',[f.payload,f.decision])
    await client.query('update public.payroll_import_finalization_actions set target_income_relationship_id=$1 where action_id=$2',[ir.id,f.actions[0]])
    if(type==='NO_CHANGE') await insert('employment_income_relationships',{tenant_id:f.tenant,administration_id:f.admin,employee_id:f.employee,employment_id:f.employment,income_relationship_id:ir.id,valid_from:'2026-01-01'})
    assert.equal((await execute(f)).status,'COMPLETED');assert.equal((await client.query('select count(*) from public.employment_income_relationships')).rows[0].count,'1')
  })
  await test('missing employment action fails closed',async()=>{const f=await fixture();delete f.payload.employmentByIncomeRelationship[f.refs[0]].action;await client.query('update public.payroll_import_decisions set decision_payload=$1 where id=$2',[f.payload,f.decision]);await rejects(()=>execute(f),'PAYROLL_FINALIZATION_EMPLOYMENT_DECISION_STALE')})
  await test('employment period mismatch rejects IKV create',async()=>{const f=await fixture();await client.query("update public.employments set starts_on='2026-02-01' where id=$1",[f.employment]);await rejects(()=>execute(f),'PAYROLL_FINALIZATION_EMPLOYMENT_SCOPE_OR_PERIOD_STALE')})
  await test('missing draft contract confirmation rejected',async()=>{const f=await fixture({type:'CREATE_DRAFT_EMPLOYMENT',draft:true});delete f.payload.employmentByIncomeRelationship[f.refs[0]].contractType;await client.query('update public.payroll_import_decisions set decision_payload=$1 where id=$2',[f.payload,f.decision]);await rejects(()=>execute(f),'PAYROLL_FINALIZATION_DRAFT_DECISION_STALE')})
  await test('wrong lease owner fenced',async()=>{const f=await fixture();await rejects(()=>execute(f,0,{owner:randomUUID()}),'PAYROLL_FINALIZATION_LEASE_FENCED')})
  await test('expired lease + normal RECOVERED + CLAIMED + completion',async()=>{const f=await fixture();await client.query("update public.payroll_import_finalization_actions set lease_until=now()-interval '1 second' where action_id=$1",[f.actions[0]]);await rejects(()=>execute(f),'PAYROLL_FINALIZATION_LEASE_FENCED');await event(f,'RECOVERED','recovered');await event(f,'CLAIMED','claimed',{attempt:2,until:new Date(Date.now()+120000).toISOString(),owner:f.owner,token:f.token});assert.equal((await execute(f)).status,'COMPLETED')})
  await test('FAILED + RETRY + CLAIMED + completion',async()=>{const f=await fixture();await event(f,'FAILED','failed',{error:'SYNTHETIC_TEST_FAILURE',owner:f.owner,token:f.token});await event(f,'RETRY','retry');await event(f,'CLAIMED','claimed',{attempt:2,until:new Date(Date.now()+120000).toISOString(),owner:f.owner,token:f.token});assert.equal((await execute(f)).status,'COMPLETED')})
  await test('wrong state token rejected',async()=>{const f=await fixture();await rejects(()=>execute(f,0,{stateToken:'0'.repeat(64)}),'PAYROLL_FINALIZATION_ACTION_PROOF_INVALID')})
  await test('wrong contract version rejected',async()=>{const f=await fixture();await client.query("update public.payroll_import_finalization_actions set contract_version='old' where action_id=$1",[f.actions[0]]);await rejects(()=>execute(f),'PAYROLL_FINALIZATION_PROVENANCE_STALE')})
  await test('incomplete dependency rejected',async()=>{const f=await fixture({count:2});await rejects(()=>execute(f,1),'PAYROLL_FINALIZATION_ACTION_DEPENDENCIES_INCOMPLETE')})
  await test('foreign employment scope rejected',async()=>{const f=await fixture();await client.query('update public.employments set hr_group_id=$1 where id=$2',[randomUUID(),f.employment]);await rejects(()=>execute(f),'PAYROLL_FINALIZATION_EMPLOYMENT_SCOPE_OR_VERSION_STALE')})

  await test('missing match action fails closed',async()=>{const f=await fixture();delete f.payload.match.action;await client.query('update public.payroll_import_decisions set decision_payload=$1 where id=$2',[f.payload,f.decision]);await rejects(()=>execute(f),'PAYROLL_FINALIZATION_EMPLOYEE_DECISION_STALE')})
  await test('lease that expires inside a transaction is fenced',async()=>{const f=await fixture();await client.query("update public.payroll_import_finalization_actions set lease_until=clock_timestamp()+interval '20 milliseconds' where action_id=$1",[f.actions[0]]);await client.query('select pg_sleep(0.04)');await rejects(()=>execute(f),'PAYROLL_FINALIZATION_LEASE_FENCED')})
  await test('draft terms are verified after INSERT',async()=>{const f=await fixture({type:'CREATE_DRAFT_EMPLOYMENT',draft:true});await client.query("create function public.synthetic_change_contract() returns trigger language plpgsql as $$ begin new.contract_type := 'DEFINITE'; return new; end $$; create trigger synthetic_contract before insert on public.employments for each row execute function public.synthetic_change_contract()");await rejects(()=>execute(f),'PAYROLL_FINALIZATION_EMPLOYMENT_READBACK_FAILED')})


  await test('overlapping second IKV fails explicitly and keeps first completion',async()=>{
    const f=await fixture({count:2});await execute(f);await rejects(()=>execute(f,1),'PAYROLL_FINALIZATION_EMPLOYMENT_IKV_PERIOD_CONFLICT')
    assert.equal((await client.query('select count(*) from public.income_relationships')).rows[0].count,'1')
    assert.equal((await client.query('select count(*) from public.employment_income_relationships')).rows[0].count,'1')
    assert.equal((await client.query('select completed_action_count from public.payroll_import_finalization_plans where id=$1',[f.plan])).rows[0].completed_action_count,1)
  })
  await test('completed Employee and draft Employment proofs are reused without duplicate Core records',async()=>{
    const f=await fixture()
    const current=(await client.query('select * from public.payroll_import_finalization_actions where action_id=$1',[f.actions[0]])).rows[0]
    const employeeRef='new-employee:'+f.batch+':row-1'
    const employmentRef='draft-employment:'+f.batch+':row-1'
    const priorEmployee='payroll-finalize:'+randomBytes(12).toString('hex')
    const priorEmployment='payroll-finalize:'+randomBytes(12).toString('hex')
    await client.query("update public.payroll_import_finalization_plans set expected_action_count=3,completed_action_count=2 where id=$1",[f.plan])
    await client.query("update public.payroll_import_finalization_actions set sequence_no=3,target_employee_id=null,target_employment_id=null,target_employee_ref=$1,target_employment_ref=$2,depends_on_action_ids=$3 where action_id=$4",[employeeRef,employmentRef,[priorEmployee,priorEmployment],f.actions[0]])
    const common={...current,status:'COMPLETED',lease_owner:null,lease_until:null,lease_token_hash:null,completed_at:new Date().toISOString(),source_income_ref:null,source_payroll_tax_number:null,source_ikv_number:null,source_starts_on:null,source_ends_on:null,target_employee_id:null,target_employment_id:null,target_employee_ref:employeeRef}
    await insert('payroll_import_finalization_actions',{...common,id:randomUUID(),action_id:priorEmployee,idempotency_key:randomUUID(),sequence_no:1,action_type:'CREATE_EMPLOYEE',source_refs:['row-1'],checkpoint:{createdEmployeeId:f.employee},depends_on_action_ids:[]})
    await insert('payroll_import_finalization_actions',{...common,id:randomUUID(),action_id:priorEmployment,idempotency_key:randomUUID(),sequence_no:2,action_type:'CREATE_DRAFT_EMPLOYMENT',source_refs:f.refs,target_employment_ref:employmentRef,draft_employment_contract_type:'INDEFINITE',draft_employment_starts_on:'2026-01-01',draft_employment_seniority_date:'2026-01-01',draft_employment_original_hire_date:'2026-01-01',checkpoint:{createdEmploymentId:f.employment},depends_on_action_ids:[priorEmployee]})
    f.payload.match={action:'CREATE_EMPLOYEE',confirmed:true}
    f.payload.employmentByIncomeRelationship[f.refs[0]]={action:'CREATE_DRAFT_EMPLOYMENT',confirmed:true,contractType:'INDEFINITE',startsOn:'2026-01-01',seniorityDate:'2026-01-01',originalHireDate:'2026-01-01'}
    await client.query('update public.payroll_import_decisions set decision_payload=$1 where id=$2',[f.payload,f.decision])
    await client.query("update public.employments set record_status='DRAFT',payroll_import_person_id=$1 where id=$2",[f.person,f.employment])
    assert.equal((await execute(f)).planStatus,'COMPLETED')
    assert.equal((await client.query('select count(*) from public.employees')).rows[0].count,'1')
    assert.equal((await client.query('select count(*) from public.employments')).rows[0].count,'1')
  })

  await test('completion event without explicit readbackVerified fails closed', async () => {
    const f = await fixture()
    const checkpoint = { completionProof: { executionId: randomUUID(), readbackHash: h, sourceHash: h, analysisHash: h, coreStateHash: h } }
    await rejects(() => event(f, 'COMPLETED', randomUUID(), { checkpoint, owner: f.owner, token: f.token }), 'PAYROLL_FINALIZATION_EVENT_INPUT_INVALID')
    assert.equal((await client.query('select count(*) from public.payroll_import_finalization_action_events')).rows[0].count, '0')
  })
  console.log(JSON.stringify({postgres:(await client.query('select version()')).rows[0].version,migration:migrationPath,results},null,2))
  await writeFile(join(runtimeRoot,'results.json'),JSON.stringify({migration:migrationPath,results},null,2))
  if(results.some(r=>r.status!=='PASS')) process.exitCode=1
} catch(e) { setupFailed = true; console.error(JSON.stringify({setupFailure:e.message,code:e.code,where:e.where})); process.exitCode=1 }
finally { if(client) await client.end(); await db.stop() }

if (setupFailed || results.some(r => r.status !== 'PASS')) process.exit(1)
