insert into public.permissions (code, name, category, description) values
  ('report-employee-department:read', 'Rapport: personeel per afdeling', 'Rapportages', 'Geeft toegang tot het rapport Personeel per afdeling.'),
  ('report-employee-gender:read', 'Rapport: personeel per geslacht', 'Rapportages', 'Geeft toegang tot het rapport Personeel per geslacht.'),
  ('report-employee-age:read', 'Rapport: personeel per leeftijd', 'Rapportages', 'Geeft toegang tot het rapport Personeel per leeftijd.'),
  ('report-terminations:read', 'Rapport: reden uit dienst', 'Rapportages', 'Geeft toegang tot het rapport Reden uit dienst.'),
  ('report-leave:read', 'Rapport: verlof in beeld', 'Rapportages', 'Geeft toegang tot het rapport Verlof in beeld.'),
  ('report-absence:read', 'Rapport: verzuim', 'Rapportages', 'Geeft toegang tot het rapport Verzuim.'),
  ('report-leave-provision:read', 'Rapport: balansvoorziening verlof', 'Rapportages', 'Geeft toegang tot het rapport Balansvoorziening verlof.'),
  ('report-wvp:read', 'Rapport: WvP-voortgang', 'Rapportages', 'Geeft toegang tot het rapport WvP-voortgang.')
on conflict (code) do update set name = excluded.name, category = excluded.category, description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code in ('TENANT_ADMIN', 'HR_ADMIN')
  and permission.code in (
    'report-employee-department:read', 'report-employee-gender:read', 'report-employee-age:read', 'report-terminations:read',
    'report-leave:read', 'report-absence:read', 'report-leave-provision:read', 'report-wvp:read'
  )
on conflict do nothing;
