-- Optimaliseer de nieuwe dienstverbandinrichting na controle met de Supabase advisors.

drop index if exists public.employment_contracts_labor_condition_set_idx;
create index employment_contracts_labor_condition_set_idx
  on public.employment_contracts (tenant_id, administration_id, labor_condition_set_id);

drop index if exists public.employment_contracts_flex_phase_idx;
create index employment_contracts_flex_phase_idx
  on public.employment_contracts (tenant_id, administration_id, flex_phase_id)
  where flex_phase_id is not null;

drop index if exists public.employment_labor_conditions_contract_idx;
create index employment_labor_conditions_contract_idx
  on public.employment_labor_conditions (
    tenant_id, administration_id, employee_id, employment_id, employment_contract_id
  );

drop index if exists public.employment_salaries_frequency_idx;
create index employment_salaries_frequency_idx
  on public.employment_salaries (tenant_id, administration_id, salary_frequency_id);

drop index if exists public.employment_cost_allocations_carrier_idx;
create index employment_cost_allocations_carrier_idx
  on public.employment_cost_allocations (tenant_id, administration_id, cost_carrier_id);

drop policy if exists labor_condition_sets_write on public.labor_condition_sets;
create policy labor_condition_sets_insert
on public.labor_condition_sets for insert to authenticated
with check ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'contract:write'
)));
create policy labor_condition_sets_update
on public.labor_condition_sets for update to authenticated
using ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'contract:write'
)))
with check ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'contract:write'
)));
create policy labor_condition_sets_delete
on public.labor_condition_sets for delete to authenticated
using ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'contract:write'
)));

drop policy if exists flex_phases_write on public.flex_phases;
create policy flex_phases_insert
on public.flex_phases for insert to authenticated
with check ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'contract:write'
)));
create policy flex_phases_update
on public.flex_phases for update to authenticated
using ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'contract:write'
)))
with check ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'contract:write'
)));
create policy flex_phases_delete
on public.flex_phases for delete to authenticated
using ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'contract:write'
)));

drop policy if exists salary_frequencies_write on public.salary_frequencies;
create policy salary_frequencies_insert
on public.salary_frequencies for insert to authenticated
with check ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'salary:write'
)));
create policy salary_frequencies_update
on public.salary_frequencies for update to authenticated
using ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'salary:write'
)))
with check ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'salary:write'
)));
create policy salary_frequencies_delete
on public.salary_frequencies for delete to authenticated
using ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'salary:write'
)));

drop policy if exists cost_carriers_write on public.cost_carriers;
create policy cost_carriers_insert
on public.cost_carriers for insert to authenticated
with check ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'contract:write'
)));
create policy cost_carriers_update
on public.cost_carriers for update to authenticated
using ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'contract:write'
)))
with check ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'contract:write'
)));
create policy cost_carriers_delete
on public.cost_carriers for delete to authenticated
using ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'contract:write'
)));

drop policy if exists statutory_minimum_wages_write on public.statutory_minimum_wages;
create policy statutory_minimum_wages_insert
on public.statutory_minimum_wages for insert to authenticated
with check ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'salary:write'
)));
create policy statutory_minimum_wages_update
on public.statutory_minimum_wages for update to authenticated
using ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'salary:write'
)))
with check ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'salary:write'
)));
create policy statutory_minimum_wages_delete
on public.statutory_minimum_wages for delete to authenticated
using ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'salary:write'
)));
