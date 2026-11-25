begin;

alter table public.performance_review_audit_events
  alter column actor_user_id drop not null;

alter table public.performance_review_audit_events
  add column actor_kind text not null default 'USER'
    check (actor_kind in ('USER', 'SYSTEM'));

alter table public.performance_review_audit_events
  add constraint performance_review_audit_actor_consistency_check
  check ((actor_kind = 'USER' and actor_user_id is not null)
      or (actor_kind = 'SYSTEM' and actor_user_id is null));

create or replace function internal_security.activate_due_performance_review_rounds()
returns integer
language plpgsql
security definer
set search_path = public, internal_security, auth, pg_temp as $$
declare
  scheduler_execution boolean := coalesce(auth.jwt() ->> 'role' = 'service_role' and auth.uid() is null, false);
  candidate record;
  activated_round record;
  activated_count integer := 0;
begin
  if not scheduler_execution then
    raise exception 'PERFORMANCE_SCHEDULER_FORBIDDEN';
  end if;

  for candidate in
    select round.id
    from public.performance_review_rounds round
    where round.status = 'SCHEDULED'
      and round.start_date <= current_date
    order by round.start_date, round.id
    for update skip locked
  loop
    update public.performance_review_rounds round
    set status = 'ACTIVE', version = round.version + 1
    where round.id = candidate.id and round.status = 'SCHEDULED'
    returning round.id, round.tenant_id into activated_round;

    if found then
      insert into public.performance_review_audit_events (tenant_id, round_id, actor_user_id, actor_kind, action)
      values (activated_round.tenant_id, activated_round.id, null, 'SYSTEM', 'ROUND_ACTIVATED');
      activated_count := activated_count + 1;
    end if;
  end loop;

  return activated_count;
end;
$$;

revoke all on function internal_security.activate_due_performance_review_rounds() from public, anon, authenticated;
grant execute on function internal_security.activate_due_performance_review_rounds() to service_role;

create or replace function public.run_due_performance_review_activations()
returns integer
language sql
security definer
set search_path = public, internal_security, auth, pg_temp as $$
  select internal_security.activate_due_performance_review_rounds();
$$;

revoke all on function public.run_due_performance_review_activations() from public, anon, authenticated;
grant execute on function public.run_due_performance_review_activations() to service_role;

commit;
