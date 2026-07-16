do $$
declare
  main_tenant uuid := md5('tenant:liquid-hr-demo-holding')::uuid;
  second_tenant uuid := md5('tenant:noorderlicht-zorggroep')::uuid;
begin
  if (select count(*) from public.employees where tenant_id = main_tenant and deleted_at is null) <> 50 then
    raise exception 'Demo tenant moet exact 50 medewerkers hebben.';
  end if;
  if (select count(*) from public.employees where tenant_id = second_tenant and deleted_at is null) <> 10 then
    raise exception 'Tweede tenant moet exact 10 medewerkers hebben.';
  end if;
  if (select count(*) from public.employments where tenant_id = main_tenant and deleted_at is null) < 49 then
    raise exception 'Employment-scenario’s ontbreken in de demo tenant.';
  end if;
  if not exists (
    select 1 from public.employments employment
    join public.employees employee on employee.id = employment.employee_id
    where employee.employee_number = 'DEMO-045'
    group by employment.administration_id having count(*) = 2
  ) then raise exception 'Parallelle dienstverbanden binnen één administratie ontbreken.'; end if;
  if (
    select count(distinct employment.administration_id)
    from public.employments employment
    join public.employees employee on employee.id = employment.employee_id
    where employee.employee_number = 'DEMO-046'
  ) <> 2 then raise exception 'Parallelle dienstverbanden over administraties ontbreken.'; end if;
  if (select count(*) from public.employments employment join public.employees employee on employee.id = employment.employee_id where employee.employee_number = 'DEMO-044') <> 2 then
    raise exception 'Herintrederhistorie ontbreekt.';
  end if;
  if exists (
    select 1 from public.employments employment
    join public.employees employee on employee.id = employment.employee_id
    where employee.employee_number in ('DEMO-047','DEMO-048','DEMO-049','DEMO-050','NZG-010')
  ) then raise exception 'Externe personen mogen geen dienstverband hebben.'; end if;
end
$$;
