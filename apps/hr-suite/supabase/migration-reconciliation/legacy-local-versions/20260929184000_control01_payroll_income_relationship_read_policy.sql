-- Geef loonheffingfinalisatie alleen de bestaande IKV-rijen leesbaar die een actor met salaris-schrijfbevoegdheid binnen de administratie mag beheren.
create policy income_relationships_select_for_salary_writers
on public.income_relationships
for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, administration_id, 'salary:write'))
);
