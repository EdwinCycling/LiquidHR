begin;

do $$
begin
  if not has_table_privilege('authenticated', 'public.employee_addresses', 'select') then
    raise exception 'authenticated mist SELECT op employee_addresses';
  end if;

  if not has_table_privilege('authenticated', 'public.employee_relations', 'select') then
    raise exception 'authenticated mist SELECT op employee_relations';
  end if;

  if not has_table_privilege('authenticated', 'public.employee_bank_accounts', 'select') then
    raise exception 'authenticated mist SELECT op employee_bank_accounts';
  end if;

  if not has_function_privilege(
    'authenticated',
    'internal_security.employee_subresource_can_read(uuid, uuid)',
    'execute'
  ) then
    raise exception 'authenticated mist EXECUTE op employee_subresource_can_read';
  end if;

  if not has_function_privilege(
    'authenticated',
    'internal_security.employee_subresource_can_write(uuid, uuid, text)',
    'execute'
  ) then
    raise exception 'authenticated mist EXECUTE op employee_subresource_can_write';
  end if;

  if not has_function_privilege(
    'authenticated',
    'internal_security.custom_field_value_can_read(uuid, uuid, uuid, uuid)',
    'execute'
  ) then
    raise exception 'authenticated mist EXECUTE op custom_field_value_can_read';
  end if;

  if not has_function_privilege(
    'authenticated',
    'internal_security.custom_field_value_can_write(uuid, uuid, uuid, uuid)',
    'execute'
  ) then
    raise exception 'authenticated mist EXECUTE op custom_field_value_can_write';
  end if;
end
$$;

rollback;
