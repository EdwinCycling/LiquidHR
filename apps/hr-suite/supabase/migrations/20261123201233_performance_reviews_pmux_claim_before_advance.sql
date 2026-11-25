-- Claims the normal PMUX task through its public authorization kernel before
-- advancing the review phase. Claim and submission stay in one transaction.
create or replace function public.performance_review_advance_pmux()
returns trigger language plpgsql security definer
set search_path = public, internal_security, auth, pg_temp as $$
declare
  dossier_row public.performance_review_dossiers;
  item_row public.process_work_items;
  step_version bigint;
begin
  if new.submitted_at is null then return new; end if;
  if tg_op = 'UPDATE' and old.submitted_at is not null then return new; end if;

  select d.* into dossier_row
  from public.performance_review_dossiers d
  where d.tenant_id = new.tenant_id and d.id = new.dossier_id;
  if dossier_row.process_instance_id is null then return new; end if;

  select item.* into item_row
  from public.process_work_items item
  where item.tenant_id = dossier_row.tenant_id
    and item.hr_group_id = dossier_row.hr_group_id
    and item.process_instance_id = dossier_row.process_instance_id
    and item.status in ('OPEN', 'CLAIMED')
  order by item.created_at
  limit 1
  for update;
  if item_row.id is null then return new; end if;

  if item_row.status = 'OPEN' then
    perform public.claim_process_work_item(item_row.id, item_row.expected_version);
    select item.* into item_row from public.process_work_items item where item.id = item_row.id;
  end if;

  select step.expected_version into step_version
  from public.process_step_instances step
  where step.tenant_id = item_row.tenant_id
    and step.hr_group_id = item_row.hr_group_id
    and step.id = item_row.step_instance_id;
  perform public.perform_process_work_item_action(
    item_row.id, 'SUBMIT', item_row.expected_version, step_version,
    'performance-review-submission:' || new.id::text, null
  );
  return new;
end;
$$;

create or replace function public.performance_review_advance_pmux_ack()
returns trigger language plpgsql security definer
set search_path = public, internal_security, auth, pg_temp as $$
declare
  dossier_row public.performance_review_dossiers;
  item_row public.process_work_items;
  step_version bigint;
begin
  select d.* into dossier_row
  from public.performance_review_dossiers d
  where d.tenant_id = new.tenant_id and d.id = new.dossier_id;
  if dossier_row.process_instance_id is null then return new; end if;

  select item.* into item_row
  from public.process_work_items item
  where item.tenant_id = dossier_row.tenant_id
    and item.hr_group_id = dossier_row.hr_group_id
    and item.process_instance_id = dossier_row.process_instance_id
    and item.status in ('OPEN', 'CLAIMED')
  order by item.created_at
  limit 1
  for update;
  if item_row.id is null then return new; end if;

  if item_row.status = 'OPEN' then
    perform public.claim_process_work_item(item_row.id, item_row.expected_version);
    select item.* into item_row from public.process_work_items item where item.id = item_row.id;
  end if;

  select step.expected_version into step_version
  from public.process_step_instances step
  where step.tenant_id = item_row.tenant_id
    and step.hr_group_id = item_row.hr_group_id
    and step.id = item_row.step_instance_id;
  perform public.perform_process_work_item_action(
    item_row.id, 'ACKNOWLEDGE', item_row.expected_version, step_version,
    'performance-review-acknowledgement:' || new.dossier_id::text, null
  );
  return new;
end;
$$;

revoke all on function public.performance_review_advance_pmux() from public, anon, authenticated;
revoke all on function public.performance_review_advance_pmux_ack() from public, anon, authenticated;
