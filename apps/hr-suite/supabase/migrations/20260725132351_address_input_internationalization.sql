alter table public.employee_addresses
  rename column addition to house_number_addition;

alter table public.employee_addresses
  rename column province to region;

alter table public.employee_addresses
  add column address_line_1 text,
  add column address_line_2 text,
  add column postal_code_normalized text,
  add column source text not null default 'manual',
  add column source_reference text;

update public.employee_addresses
set
  address_line_1 = trim(concat_ws(' ', street, house_number, house_number_addition)),
  postal_code_normalized = upper(regexp_replace(postal_code, '\\s+', '', 'g'))
where address_line_1 is null;

alter table public.employee_addresses
  alter column address_line_1 set not null,
  alter column street drop not null,
  alter column house_number drop not null,
  alter column postal_code drop not null;

alter table public.employee_addresses
  add constraint employee_addresses_address_line_1_valid
    check (length(trim(address_line_1)) between 1 and 240),
  add constraint employee_addresses_address_line_2_valid
    check (address_line_2 is null or length(trim(address_line_2)) between 1 and 240),
  add constraint employee_addresses_source_valid
    check (source in ('manual', 'pdok', 'geoapify')),
  add constraint employee_addresses_country_requirements
    check (
      country_code <> 'NL'
      or (street is not null and house_number is not null and postal_code is not null)
    ),
  add constraint employee_addresses_city_valid
    check (length(trim(city)) between 1 and 120);

create index employee_addresses_country_period_idx
  on public.employee_addresses (tenant_id, employee_id, country_code, valid_from desc)
  where deleted_at is null;

comment on column public.employee_addresses.address_line_1 is
  'Canonical address line; derived from structured Dutch fields and primary for international addresses';
comment on column public.employee_addresses.source is
  'Address origin: manual, pdok, or geoapify';
comment on column public.employee_addresses.source_reference is
  'Provider reference only; never a replacement for address fields';
