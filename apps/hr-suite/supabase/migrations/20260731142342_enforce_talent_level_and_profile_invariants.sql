create unique index if not exists talent_level_models_one_per_tenant_idx
  on public.talent_level_models (tenant_id);

alter table public.job_profile_versions
  add constraint job_profile_versions_active_dates_check
  check (status <> 'ACTIVE' or valid_from is not null);

create or replace function internal_security.prevent_locked_talent_level_model_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  model_locked timestamptz;
begin
  if tg_op = 'DELETE' then
    select locked_at into model_locked from public.talent_level_models
    where tenant_id = old.tenant_id and id = old.level_model_id;
  else
    select locked_at into model_locked from public.talent_level_models
    where tenant_id = new.tenant_id and id = new.level_model_id;
  end if;
  if model_locked is not null then
    raise exception 'TALENT_LEVEL_MODEL_LOCKED' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function internal_security.prevent_locked_talent_level_model_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.locked_at is not null and (
    new.code is distinct from old.code or
    new.name is distinct from old.name or
    new.description is distinct from old.description or
    new.status is distinct from old.status
  ) then
    raise exception 'TALENT_LEVEL_MODEL_LOCKED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function internal_security.lock_talent_level_model_on_use()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.target_level_id is not null then
    update public.talent_level_models model
    set locked_at = coalesce(model.locked_at, timezone('utc', now()))
    from public.talent_levels level
    where level.tenant_id = new.tenant_id
      and level.id = new.target_level_id
      and model.tenant_id = level.tenant_id
      and model.id = level.level_model_id
      and model.locked_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists talent_level_model_lock_guard on public.talent_level_models;
create trigger talent_level_model_lock_guard
before update on public.talent_level_models
for each row execute function internal_security.prevent_locked_talent_level_model_update();

drop trigger if exists talent_level_lock_guard on public.talent_levels;
create trigger talent_level_lock_guard
before delete or update on public.talent_levels
for each row execute function internal_security.prevent_locked_talent_level_model_change();

drop trigger if exists talent_level_model_lock_on_requirement on public.job_profile_capability_requirements;
create trigger talent_level_model_lock_on_requirement
after insert or update of target_level_id on public.job_profile_capability_requirements
for each row execute function internal_security.lock_talent_level_model_on_use();

create or replace function public.activate_job_profile_version(
  requested_tenant_id uuid,
  requested_version_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  target_profile_id uuid;
  target_valid_from date;
  target_valid_until date;
begin
  if not internal_security.current_user_has_permission(requested_tenant_id, null, 'talent:manage') then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select job_profile_id, valid_from, valid_until
    into target_profile_id, target_valid_from, target_valid_until
  from public.job_profile_versions
  where tenant_id = requested_tenant_id and id = requested_version_id
  for update;

  if target_profile_id is null then
    raise exception 'TALENT_PROFILE_VERSION_NOT_FOUND' using errcode = 'P0001';
  end if;

  target_valid_from := coalesce(target_valid_from, current_date);
  if target_valid_until is not null and target_valid_until <= target_valid_from then
    raise exception 'TALENT_PROFILE_PERIOD_INVALID' using errcode = 'P0001';
  end if;

  update public.job_profile_versions
  set status = 'INACTIVE', valid_until = target_valid_from, updated_at = timezone('utc', now())
  where tenant_id = requested_tenant_id
    and job_profile_id = target_profile_id
    and id <> requested_version_id
    and status = 'ACTIVE';

  update public.job_profile_versions
  set status = 'ACTIVE', valid_from = target_valid_from, activated_by_user_id = auth.uid(), updated_at = timezone('utc', now())
  where tenant_id = requested_tenant_id and id = requested_version_id;

  return requested_version_id;
end;
$$;

revoke all on function public.activate_job_profile_version(uuid, uuid) from public, anon;
grant execute on function public.activate_job_profile_version(uuid, uuid) to authenticated;
