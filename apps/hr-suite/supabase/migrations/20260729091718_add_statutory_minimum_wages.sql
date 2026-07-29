create table public.statutory_minimum_wages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  administration_id uuid not null,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  minimum_age smallint not null check (minimum_age between 15 and 21),
  hourly_amount numeric(12,4) not null check (hourly_amount > 0),
  currency_code text not null default 'EUR' check (currency_code ~ '^[A-Z]{3}$'),
  valid_from date not null,
  valid_until date,
  source_url text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint statutory_minimum_wages_period_valid
    check (valid_until is null or valid_until > valid_from),
  constraint statutory_minimum_wages_administration_fkey
    foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id) on delete cascade,
  constraint statutory_minimum_wages_period_key
    unique (tenant_id, administration_id, country_code, minimum_age, valid_from)
);

insert into public.statutory_minimum_wages (
  tenant_id, administration_id, country_code, minimum_age,
  hourly_amount, valid_from, valid_until, source_url
)
select
  administration.tenant_id, administration.id, 'NL',
  rate.minimum_age, rate.hourly_amount, rate.valid_from, rate.valid_until,
  'https://www.rijksoverheid.nl/themas/werk/minimumloon/bedragen-minimumloon/bedragen-minimumloon-2026'
from public.administrations administration
cross join (
  values
    (15, 4.41::numeric, '2026-01-01'::date, '2026-07-01'::date),
    (16, 5.07::numeric, '2026-01-01'::date, '2026-07-01'::date),
    (17, 5.81::numeric, '2026-01-01'::date, '2026-07-01'::date),
    (18, 7.36::numeric, '2026-01-01'::date, '2026-07-01'::date),
    (19, 8.83::numeric, '2026-01-01'::date, '2026-07-01'::date),
    (20, 11.77::numeric, '2026-01-01'::date, '2026-07-01'::date),
    (21, 14.71::numeric, '2026-01-01'::date, '2026-07-01'::date),
    (15, 4.50::numeric, '2026-07-01'::date, null::date),
    (16, 5.17::numeric, '2026-07-01'::date, null::date),
    (17, 5.92::numeric, '2026-07-01'::date, null::date),
    (18, 7.50::numeric, '2026-07-01'::date, null::date),
    (19, 8.99::numeric, '2026-07-01'::date, null::date),
    (20, 11.99::numeric, '2026-07-01'::date, null::date),
    (21, 14.99::numeric, '2026-07-01'::date, null::date)
) as rate(minimum_age, hourly_amount, valid_from, valid_until);

create index statutory_minimum_wages_lookup_idx
on public.statutory_minimum_wages (
  tenant_id, administration_id, country_code, valid_from, valid_until, minimum_age
);

create trigger set_statutory_minimum_wages_updated_at
before update on public.statutory_minimum_wages
for each row execute function internal_security.set_updated_at();

alter table public.statutory_minimum_wages enable row level security;
create policy statutory_minimum_wages_read
on public.statutory_minimum_wages for select to authenticated
using ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'salary:read'
)));
create policy statutory_minimum_wages_write
on public.statutory_minimum_wages for all to authenticated
using ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'salary:write'
)))
with check ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'salary:write'
)));

revoke all on public.statutory_minimum_wages from anon;
grant select, insert, update, delete on public.statutory_minimum_wages to authenticated;
