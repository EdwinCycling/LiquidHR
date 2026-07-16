begin;

do $$
declare
  demo_tenant uuid := md5('tenant:liquid-hr-demo-holding')::uuid;
  administration_one uuid;
  administration_two uuid;
  definition_id uuid := md5('custom-field:test-definition')::uuid;
  first_value bigint;
  second_value bigint;
begin
  select id into administration_one from public.administrations
  where tenant_id = demo_tenant order by code limit 1;
  select id into administration_two from public.administrations
  where tenant_id = demo_tenant and id <> administration_one order by code limit 1;

  insert into public.custom_field_definitions (
    id, tenant_id, administration_id, entity_type, key,
    label_nl, label_en, field_type, hr_access, manager_access,
    employee_self_access, is_required
  ) values (
    definition_id, demo_tenant, administration_one, 'EMPLOYEE', 'test_veiligheidsmiddel',
    'Veiligheidsmiddel', 'Safety equipment', 'AUTO_INCREMENT', 'WRITE', 'READ',
    'READ', true
  );

  begin
    update public.custom_field_definitions set key = 'gewijzigd' where id = definition_id;
    raise exception 'Technische vrije-veldsleutel kan worden gewijzigd.';
  exception when check_violation then null;
  end;

  begin
    insert into public.custom_field_select_options (
      tenant_id, administration_id, definition_id, value, label_nl, label_en
    ) values (
      demo_tenant, administration_two, definition_id, 'X', 'Optie', 'Option'
    );
    raise exception 'Cross-administration selectoptie is toegestaan.';
  exception when foreign_key_violation then null;
  end;

  first_value := public.next_custom_field_value(definition_id);
  second_value := public.next_custom_field_value(definition_id);
  if first_value <> 1 or second_value <> 2 then
    raise exception 'AUTO_INCREMENT counter is niet atomair oplopend.';
  end if;
end
$$;

rollback;
