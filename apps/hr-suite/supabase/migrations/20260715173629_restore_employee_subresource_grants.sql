-- Herstel expliciete Data API- en RLS-helperrechten.
-- De helpers zijn SECURITY DEFINER, maar de policy-evaluatie vereist alsnog EXECUTE.
grant select, insert, update on public.employee_addresses to authenticated;
grant select, insert, update on public.employee_relations to authenticated;
grant select, insert, update on public.employee_bank_accounts to authenticated;

grant execute on function internal_security.employee_subresource_can_read(uuid, uuid)
  to authenticated;
grant execute on function internal_security.employee_subresource_can_write(uuid, uuid, text)
  to authenticated;
grant execute on function internal_security.custom_field_value_can_read(uuid, uuid, uuid, uuid)
  to authenticated;
grant execute on function internal_security.custom_field_value_can_write(uuid, uuid, uuid, uuid)
  to authenticated;
