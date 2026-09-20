begin;

-- Alleen zichtbare namen van de synthetische demo-inrichting wijzigen.
-- Technische codes, ids, relaties, medewerkers en autorisaties blijven gelijk.
update public.tenants
set name = 'De Sterren holding'
where slug = 'liquid-hr-demo-holding';

update public.hr_groups
set name = 'Planeten'
where tenant_id = (
    select id
    from public.tenants
    where slug = 'liquid-hr-demo-holding'
  )
  and code = 'DEFAULT';

update public.hr_groups
set name = 'TEST (leeg)'
where tenant_id = (
    select id
    from public.tenants
    where slug = 'liquid-hr-demo-holding'
  )
  and code = 'TEST-BOUNDARY';

update public.administrations
set name = 'Mars BV'
where tenant_id = (
    select id
    from public.tenants
    where slug = 'liquid-hr-demo-holding'
  )
  and code = 'HOLDING';

update public.administrations
set name = 'Jupiter BV'
where tenant_id = (
    select id
    from public.tenants
    where slug = 'liquid-hr-demo-holding'
  )
  and code = 'OPERATIONS';

update public.administrations
set name = 'Mercurius BV'
where tenant_id = (
    select id
    from public.tenants
    where slug = 'liquid-hr-demo-holding'
  )
  and code = 'SERVICES';

update public.administrations
set name = 'Test BV'
where tenant_id = (
    select id
    from public.tenants
    where slug = 'liquid-hr-demo-holding'
  )
  and code = 'TEST-BOUNDARY-ADMIN';

update public.administrations
set name = 'DGA administratie'
where tenant_id = (
    select id
    from public.tenants
    where slug = 'liquid-hr-demo-holding'
  )
  and code = 'TEST-MULTIGROUP-ADMIN';

commit;