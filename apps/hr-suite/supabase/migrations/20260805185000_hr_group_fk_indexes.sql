begin;

-- Keep the new composite HR-group foreign keys indexed in their referencing order.
-- This preserves efficient cascade/restrict checks and makes the group boundary
-- explicit for every HR-group-owned relationship.
create index if not exists absence_capacity_changes_case_hr_group_idx
  on public.absence_capacity_changes (tenant_id, hr_group_id, case_id);
create index if not exists absence_capacity_changes_spell_hr_group_idx
  on public.absence_capacity_changes (tenant_id, hr_group_id, spell_id);
create index if not exists absence_cases_employment_hr_group_idx
  on public.absence_cases (tenant_id, hr_group_id, employment_id);
create index if not exists absence_spells_case_hr_group_idx
  on public.absence_spells (tenant_id, hr_group_id, case_id);
create index if not exists employee_organizations_employment_hr_group_idx
  on public.employee_organizations (tenant_id, hr_group_id, employment_id);
create index if not exists employment_contracts_administration_hr_group_idx
  on public.employment_contracts (tenant_id, hr_group_id, administration_id);
create index if not exists employment_contracts_labor_condition_hr_group_idx
  on public.employment_contracts (tenant_id, hr_group_id, labor_condition_set_id);
create index if not exists employment_labor_conditions_contract_hr_group_idx
  on public.employment_labor_conditions
    (tenant_id, hr_group_id, employment_id, employment_contract_id);
create index if not exists employment_leave_profiles_employment_hr_group_idx
  on public.employment_leave_profiles (tenant_id, hr_group_id, employment_id);
create index if not exists employment_work_hour_entries_employment_hr_group_idx
  on public.employment_work_hour_entries (tenant_id, hr_group_id, employment_id);
create index if not exists employments_administration_hr_group_idx
  on public.employments (tenant_id, hr_group_id, administration_id);
create index if not exists labor_condition_sets_administration_hr_group_idx
  on public.labor_condition_sets (tenant_id, hr_group_id, administration_id);
create index if not exists leave_accrual_exceptions_employment_hr_group_idx
  on public.leave_accrual_exceptions (tenant_id, hr_group_id, employment_id);
create index if not exists leave_accrual_transactions_employment_hr_group_idx
  on public.leave_accrual_transactions (tenant_id, hr_group_id, employment_id);
create index if not exists leave_balance_buckets_employment_hr_group_idx
  on public.leave_balance_buckets (tenant_id, hr_group_id, employment_id);
create index if not exists leave_request_allocations_employment_hr_group_idx
  on public.leave_request_allocations (tenant_id, hr_group_id, employment_id);
create index if not exists leave_requests_employment_hr_group_idx
  on public.leave_requests (tenant_id, hr_group_id, employment_id);
create index if not exists leave_year_rollover_items_employment_hr_group_idx
  on public.leave_year_rollover_items (tenant_id, hr_group_id, employment_id);
create index if not exists user_access_hr_group_idx
  on public.user_access (tenant_id, hr_group_id);
create index if not exists user_hr_group_access_hr_group_idx
  on public.user_hr_group_access (tenant_id, hr_group_id);
create index if not exists user_hr_group_access_management_role_idx
  on public.user_hr_group_access (management_role_id);
create index if not exists hr_groups_created_by_user_idx
  on public.hr_groups (created_by_user_id);
create index if not exists hr_groups_updated_by_user_idx
  on public.hr_groups (updated_by_user_id);

commit;
