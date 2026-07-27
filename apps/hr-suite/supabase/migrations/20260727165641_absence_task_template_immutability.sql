create or replace function internal_security.guard_absence_task_template_identity()
returns trigger
language plpgsql
set search_path = public, internal_security, pg_temp
as $$
begin
  if new.tenant_id <> old.tenant_id
    or new.administration_id <> old.administration_id
    or new.code <> old.code
    or new.source <> old.source
    or new.is_system <> old.is_system then
    raise exception 'ABSENCE_TASK_TEMPLATE_IDENTITY_IMMUTABLE' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function internal_security.guard_absence_task_template_identity() from public, anon, authenticated;

create trigger absence_task_templates_identity_guard
  before update on public.absence_task_templates
  for each row execute function internal_security.guard_absence_task_template_identity();
