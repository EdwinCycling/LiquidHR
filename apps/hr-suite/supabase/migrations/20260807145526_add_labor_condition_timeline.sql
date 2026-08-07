-- CAO- en bedrijfseigen regelingen krijgen een expliciete, opvolgende tijdlijn.
-- De bestaande labor_condition_sets blijven de contractreferentie; iedere rij
-- is vanaf nu een versie van een regeling.

alter table public.labor_condition_sets
  add column if not exists valid_from date;

alter table public.labor_condition_sets
  add column if not exists predecessor_id uuid;

update public.labor_condition_sets condition_set
set valid_from = coalesce(
  (
    select min(contract.starts_on)
    from public.employment_contracts contract
    where contract.tenant_id = condition_set.tenant_id
      and contract.administration_id = condition_set.administration_id
      and contract.labor_condition_set_id = condition_set.id
  ),
  condition_set.created_at::date,
  current_date
)
where condition_set.valid_from is null;

alter table public.labor_condition_sets
  alter column valid_from set default current_date,
  alter column valid_from set not null;

alter table public.labor_condition_sets
  add constraint labor_condition_sets_valid_from_check
    check (valid_from >= date '1900-01-01');

alter table public.labor_condition_sets
  add constraint labor_condition_sets_predecessor_fkey
    foreign key (tenant_id, administration_id, predecessor_id)
    references public.labor_condition_sets(tenant_id, administration_id, id)
    on delete restrict;

create index if not exists labor_condition_sets_timeline_idx
  on public.labor_condition_sets (tenant_id, administration_id, valid_from);

create unique index if not exists labor_condition_sets_one_successor_idx
  on public.labor_condition_sets (tenant_id, administration_id, predecessor_id)
  where predecessor_id is not null;

create or replace function internal_security.validate_labor_condition_set_timeline()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  predecessor_date date;
  successor_date date;
  cycle_found boolean;
begin
  if new.predecessor_id is not null then
    if new.predecessor_id = new.id then
      raise exception 'LABOR_CONDITION_PREDECESSOR_INVALID' using errcode = 'P0001';
    end if;

    select condition_set.valid_from
    into predecessor_date
    from public.labor_condition_sets condition_set
    where condition_set.tenant_id = new.tenant_id
      and condition_set.administration_id = new.administration_id
      and condition_set.id = new.predecessor_id;

    if predecessor_date is null or new.valid_from <= predecessor_date then
      raise exception 'LABOR_CONDITION_START_MUST_FOLLOW_PREDECESSOR' using errcode = 'P0001';
    end if;

    with recursive ancestors(id) as (
      select condition_set.predecessor_id
      from public.labor_condition_sets condition_set
      where condition_set.tenant_id = new.tenant_id
        and condition_set.administration_id = new.administration_id
        and condition_set.id = new.predecessor_id
      union all
      select condition_set.predecessor_id
      from public.labor_condition_sets condition_set
      join ancestors ancestor on ancestor.id = condition_set.id
      where condition_set.tenant_id = new.tenant_id
        and condition_set.administration_id = new.administration_id
        and condition_set.predecessor_id is not null
    )
    select exists (select 1 from ancestors where id = new.id)
    into cycle_found;

    if cycle_found then
      raise exception 'LABOR_CONDITION_TIMELINE_CYCLE' using errcode = 'P0001';
    end if;
  end if;

  select condition_set.valid_from
  into successor_date
  from public.labor_condition_sets condition_set
  where condition_set.tenant_id = new.tenant_id
    and condition_set.administration_id = new.administration_id
    and condition_set.predecessor_id = new.id
    and condition_set.id <> new.id;

  if successor_date is not null and new.valid_from >= successor_date then
    raise exception 'LABOR_CONDITION_START_MUST_PRECEDE_SUCCESSOR' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function internal_security.validate_labor_condition_set_timeline() from public, anon, authenticated;

drop trigger if exists validate_labor_condition_set_timeline on public.labor_condition_sets;
create trigger validate_labor_condition_set_timeline
before insert or update of tenant_id, administration_id, predecessor_id, valid_from
on public.labor_condition_sets
for each row execute function internal_security.validate_labor_condition_set_timeline();

create or replace function public.create_labor_condition_successor(
  requested_tenant_id uuid,
  requested_administration_id uuid,
  requested_predecessor_id uuid,
  requested_name text,
  requested_valid_from date,
  requested_standard_hours_per_week numeric
)
returns public.labor_condition_sets
language plpgsql
security invoker
set search_path = ''
as $$
declare
  predecessor public.labor_condition_sets;
  new_row public.labor_condition_sets;
  base_code text;
  candidate_code text;
  suffix integer := 1;
begin
  if not (select internal_security.current_user_has_permission(
    requested_tenant_id,
    requested_administration_id,
    'contract:write'
  )) then
    raise exception 'INSUFFICIENT_CONTRACT_PERMISSION' using errcode = '42501';
  end if;

  select * into predecessor
  from public.labor_condition_sets condition_set
  where condition_set.tenant_id = requested_tenant_id
    and condition_set.administration_id = requested_administration_id
    and condition_set.id = requested_predecessor_id;

  if predecessor.id is null then
    raise exception 'LABOR_CONDITION_PREDECESSOR_NOT_FOUND' using errcode = 'P0001';
  end if;

  if requested_valid_from <= predecessor.valid_from then
    raise exception 'LABOR_CONDITION_START_MUST_FOLLOW_PREDECESSOR' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.labor_condition_sets condition_set
    where condition_set.tenant_id = requested_tenant_id
      and condition_set.administration_id = requested_administration_id
      and condition_set.predecessor_id = requested_predecessor_id
  ) then
    raise exception 'LABOR_CONDITION_SUCCESSOR_EXISTS' using errcode = 'P0001';
  end if;

  base_code := left(regexp_replace(upper(predecessor.code), '[^A-Z0-9]+', '-', 'g'), 28);
  candidate_code := rtrim(base_code, '-') || '-' || to_char(requested_valid_from, 'YYYYMMDD');
  while exists (
    select 1 from public.labor_condition_sets condition_set
    where condition_set.tenant_id = requested_tenant_id
      and condition_set.administration_id = requested_administration_id
      and condition_set.code = candidate_code
  ) loop
    candidate_code := left(rtrim(base_code, '-'), 23) || '-' || to_char(requested_valid_from, 'YYYYMMDD') || '-' || suffix::text;
    suffix := suffix + 1;
  end loop;

  insert into public.labor_condition_sets (
    tenant_id,
    administration_id,
    hr_group_id,
    code,
    name,
    standard_hours_per_week,
    is_active,
    valid_from,
    predecessor_id
  ) values (
    requested_tenant_id,
    requested_administration_id,
    predecessor.hr_group_id,
    candidate_code,
    trim(requested_name),
    requested_standard_hours_per_week,
    true,
    requested_valid_from,
    requested_predecessor_id
  )
  returning * into new_row;

  update public.labor_condition_sets
  set is_active = false
  where tenant_id = requested_tenant_id
    and administration_id = requested_administration_id
    and id = requested_predecessor_id;

  return new_row;
end;
$$;

revoke all on function public.create_labor_condition_successor(uuid, uuid, uuid, text, date, numeric) from public, anon;
grant execute on function public.create_labor_condition_successor(uuid, uuid, uuid, text, date, numeric) to authenticated;
