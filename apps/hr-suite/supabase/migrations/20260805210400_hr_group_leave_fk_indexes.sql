begin;

-- Cover the composite Step 7 foreign keys explicitly. The group access
-- indexes remain the authorization path; these indexes cover child-to-parent
-- maintenance and lookup paths reported by the Supabase performance advisor.
create index if not exists employee_set_members_created_by_idx on public.employee_set_members (created_by);
create index if not exists employee_sets_created_by_idx on public.employee_sets (created_by);
create index if not exists employee_sets_profile_group_idx on public.employee_sets (tenant_id, hr_group_id, leave_profile_id);
create index if not exists employee_sets_updated_by_idx on public.employee_sets (updated_by);
create index if not exists employment_leave_profiles_profile_group_idx on public.employment_leave_profiles (tenant_id, hr_group_id, leave_profile_id);
create index if not exists leave_accrual_exceptions_type_group_idx on public.leave_accrual_exceptions (tenant_id, hr_group_id, leave_type_id);
create index if not exists leave_accrual_rule_pause_types_rule_group_idx on public.leave_accrual_rule_pause_types (tenant_id, hr_group_id, accrual_rule_id);
create index if not exists leave_accrual_rule_pause_types_type_group_idx on public.leave_accrual_rule_pause_types (tenant_id, hr_group_id, pause_leave_type_id);
create index if not exists leave_accrual_rule_work_hour_types_rule_group_idx on public.leave_accrual_rule_work_hour_types (tenant_id, hr_group_id, accrual_rule_id);
create index if not exists leave_accrual_rule_work_hour_types_type_group_idx on public.leave_accrual_rule_work_hour_types (tenant_id, hr_group_id, work_hour_type_id);
create index if not exists leave_accrual_rules_type_group_idx on public.leave_accrual_rules (tenant_id, hr_group_id, leave_type_id);
create index if not exists leave_balance_buckets_type_group_idx on public.leave_balance_buckets (tenant_id, hr_group_id, leave_type_id);
create index if not exists leave_bonus_rules_profile_group_idx on public.leave_bonus_rules (tenant_id, hr_group_id, leave_profile_id);
create index if not exists leave_bonus_rules_type_group_idx on public.leave_bonus_rules (tenant_id, hr_group_id, leave_type_id);
create index if not exists leave_bonus_tiers_rule_group_idx on public.leave_bonus_tiers (tenant_id, hr_group_id, bonus_rule_id);
create index if not exists leave_priority_rule_items_rule_group_idx on public.leave_priority_rule_items (tenant_id, hr_group_id, priority_rule_id);
create index if not exists leave_priority_rule_items_type_group_idx on public.leave_priority_rule_items (tenant_id, hr_group_id, leave_type_id);
create index if not exists leave_priority_rules_profile_group_idx on public.leave_priority_rules (tenant_id, hr_group_id, leave_profile_id);
create index if not exists leave_request_allocations_bucket_group_idx on public.leave_request_allocations (tenant_id, hr_group_id, employment_id, leave_type_id, bucket_id);
create index if not exists leave_request_allocations_request_group_idx on public.leave_request_allocations (tenant_id, hr_group_id, request_id);
create index if not exists leave_request_allocations_type_group_idx on public.leave_request_allocations (tenant_id, hr_group_id, leave_type_id);
create index if not exists leave_requests_leave_type_group_idx on public.leave_requests (tenant_id, hr_group_id, leave_type_id);
create index if not exists leave_requests_priority_rule_group_idx on public.leave_requests (tenant_id, hr_group_id, priority_rule_id);
create index if not exists leave_year_rollover_items_bucket_group_idx on public.leave_year_rollover_items (tenant_id, hr_group_id, employment_id, leave_type_id, source_bucket_id);
create index if not exists leave_year_rollover_items_rollover_group_idx on public.leave_year_rollover_items (tenant_id, hr_group_id, rollover_id);
create index if not exists leave_year_rollover_items_type_group_idx on public.leave_year_rollover_items (tenant_id, hr_group_id, leave_type_id);
create index if not exists overtime_type_exceptions_created_by_idx on public.overtime_type_exceptions (created_by);
create index if not exists overtime_type_exceptions_employee_group_idx on public.overtime_type_exceptions (tenant_id, hr_group_id, employee_id);
create index if not exists overtime_type_exceptions_updated_by_idx on public.overtime_type_exceptions (updated_by);
create index if not exists overtime_type_settings_created_by_idx on public.overtime_type_settings (created_by);
create index if not exists overtime_type_settings_updated_by_idx on public.overtime_type_settings (updated_by);

commit;
