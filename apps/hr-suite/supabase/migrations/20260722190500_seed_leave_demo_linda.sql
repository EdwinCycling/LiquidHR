-- Herhaalbare demonstratieset voor de gekozen demo-administratie.
insert into public.leave_settings (tenant_id, administration_id, half_day_minutes)
select administration.tenant_id, administration.id, 240
  from public.administrations administration
 where administration.name = 'Liquid HR Demo Holding B.V.'
on conflict (tenant_id, administration_id) do update
  set half_day_minutes = excluded.half_day_minutes, updated_at = timezone('utc', now());

insert into public.work_hour_types (tenant_id, administration_id, name, color_code, category, is_active)
select administration.tenant_id, administration.id, values_row.name, values_row.color_code, values_row.category::public.work_hour_type_category, true
  from public.administrations administration
 cross join (values
   ('Gewerkte uren', 'var(--chart-2)', 'REGULAR_WORK'),
   ('Overuren', 'var(--chart-4)', 'OVERTIME'),
   ('Thuiswerk', 'var(--chart-3)', 'INFORMATIONAL')
 ) as values_row(name, color_code, category)
 where administration.name = 'Liquid HR Demo Holding B.V.'
on conflict (tenant_id, administration_id, name) do update
  set color_code = excluded.color_code, category = excluded.category, is_active = true;

insert into public.leave_types (tenant_id, administration_id, name, color_code, scope, entitlement_mode, is_active, is_self_service, is_system)
select administration.tenant_id, administration.id, 'Wettelijk verlof', 'var(--chart-5)', 'STATUTORY', 'ACCRUAL', true, true, false
  from public.administrations administration
 where administration.name = 'Liquid HR Demo Holding B.V.'
on conflict (tenant_id, administration_id, name) do update
  set color_code = excluded.color_code, scope = excluded.scope, entitlement_mode = excluded.entitlement_mode, is_active = true;

insert into public.leave_profiles (tenant_id, administration_id, name, description, is_active)
select administration.tenant_id, administration.id, 'Wettelijk verlof 2026', 'Demoprofiel met 160 uur wettelijke vakantie per kalenderjaar.', true
  from public.administrations administration
 where administration.name = 'Liquid HR Demo Holding B.V.'
on conflict (tenant_id, administration_id, name) do update
  set description = excluded.description, is_active = true;

insert into public.leave_accrual_rules (
  tenant_id, administration_id, leave_profile_id, leave_type_id, valid_from,
  accrual_basis, accrual_frequency, accrual_timing, accrual_amount, expiration_months
)
select administration.tenant_id, administration.id, profile.id, type.id, date '2026-01-01',
  'CONTRACT_HOURS', 'YEARLY', 'UPFRONT', 160, 6
  from public.administrations administration
  join public.leave_profiles profile on profile.tenant_id = administration.tenant_id and profile.administration_id = administration.id and profile.name = 'Wettelijk verlof 2026'
  join public.leave_types type on type.tenant_id = administration.tenant_id and type.administration_id = administration.id and type.name = 'Wettelijk verlof'
 where administration.name = 'Liquid HR Demo Holding B.V.'
   and not exists (
     select 1 from public.leave_accrual_rules existing
      where existing.tenant_id = administration.tenant_id and existing.administration_id = administration.id
        and existing.leave_profile_id = profile.id and existing.leave_type_id = type.id and existing.valid_from = date '2026-01-01'
   );

insert into public.employment_leave_profiles (tenant_id, administration_id, employee_id, employment_id, leave_profile_id, valid_from)
select administration.tenant_id, administration.id, employee.id, employment.id, profile.id, date '2026-01-01'
  from public.administrations administration
  join public.employees employee on employee.tenant_id = administration.tenant_id and lower(employee.first_name) = 'lina' and lower(employee.birth_name) = 'bakker' and employee.deleted_at is null
  join public.employments employment on employment.tenant_id = administration.tenant_id and employment.administration_id = administration.id and employment.employee_id = employee.id
  join public.leave_profiles profile on profile.tenant_id = administration.tenant_id and profile.administration_id = administration.id and profile.name = 'Wettelijk verlof 2026'
 where administration.name = 'Liquid HR Demo Holding B.V.' and employment.starts_on <= date '2026-01-01' and (employment.ends_on is null or employment.ends_on >= date '2026-01-01')
   and not exists (
     select 1 from public.employment_leave_profiles existing
      where existing.tenant_id = administration.tenant_id and existing.administration_id = administration.id and existing.employment_id = employment.id and existing.leave_profile_id = profile.id
   );

insert into public.leave_balance_buckets (
  tenant_id, administration_id, employee_id, employment_id, leave_type_id, accrual_year,
  accrual_reference_date, total_accrued, expiration_date
)
select administration.tenant_id, administration.id, employee.id, employment.id, type.id, 2026,
  date '2026-01-01', 160, date '2027-07-01'
  from public.administrations administration
  join public.employees employee on employee.tenant_id = administration.tenant_id and lower(employee.first_name) = 'lina' and lower(employee.birth_name) = 'bakker' and employee.deleted_at is null
  join public.employments employment on employment.tenant_id = administration.tenant_id and employment.administration_id = administration.id and employment.employee_id = employee.id
  join public.leave_types type on type.tenant_id = administration.tenant_id and type.administration_id = administration.id and type.name = 'Wettelijk verlof'
 where administration.name = 'Liquid HR Demo Holding B.V.' and employment.starts_on <= date '2026-01-01' and (employment.ends_on is null or employment.ends_on >= date '2026-01-01')
   and not exists (
     select 1 from public.leave_balance_buckets existing
      where existing.tenant_id = administration.tenant_id and existing.administration_id = administration.id and existing.employment_id = employment.id and existing.leave_type_id = type.id and existing.accrual_year = 2026
   );

insert into public.leave_accrual_transactions (
  tenant_id, administration_id, employee_id, employment_id, leave_type_id, bucket_id,
  transaction_type, amount, source_type, source_id, source_key, transaction_date
)
select bucket.tenant_id, bucket.administration_id, bucket.employee_id, bucket.employment_id, bucket.leave_type_id, bucket.id,
  'ACCRUAL', 160, 'DEMO_SEED', rule.id, 'DEMO_LINA_STATUTORY_2026', date '2026-01-01'
  from public.leave_balance_buckets bucket
  join public.leave_types type on type.id = bucket.leave_type_id and type.name = 'Wettelijk verlof'
  join public.leave_accrual_rules rule on rule.tenant_id = bucket.tenant_id and rule.administration_id = bucket.administration_id and rule.leave_type_id = bucket.leave_type_id and rule.valid_from = date '2026-01-01'
 where bucket.accrual_year = 2026
   and not exists (select 1 from public.leave_accrual_transactions transaction where transaction.bucket_id = bucket.id and transaction.source_key = 'DEMO_LINA_STATUTORY_2026');

insert into public.leave_priority_rules (tenant_id, administration_id, leave_profile_id, name, valid_from, is_active)
select administration.tenant_id, administration.id, profile.id, 'Verlof', date '2026-01-01', true
  from public.administrations administration
  join public.leave_profiles profile on profile.tenant_id = administration.tenant_id and profile.administration_id = administration.id and profile.name = 'Wettelijk verlof 2026'
 where administration.name = 'Liquid HR Demo Holding B.V.'
   and not exists (
     select 1 from public.leave_priority_rules existing where existing.tenant_id = administration.tenant_id and existing.administration_id = administration.id and existing.leave_profile_id = profile.id and existing.name = 'Verlof' and existing.valid_from = date '2026-01-01'
   );

insert into public.leave_priority_rule_items (tenant_id, administration_id, priority_rule_id, leave_type_id, sort_order)
select rule.tenant_id, rule.administration_id, rule.id, type.id, 1
  from public.leave_priority_rules rule
  join public.leave_types type on type.tenant_id = rule.tenant_id and type.administration_id = rule.administration_id and type.name = 'Wettelijk verlof'
 where rule.name = 'Verlof' and rule.valid_from = date '2026-01-01'
   and not exists (select 1 from public.leave_priority_rule_items existing where existing.priority_rule_id = rule.id and existing.leave_type_id = type.id);
