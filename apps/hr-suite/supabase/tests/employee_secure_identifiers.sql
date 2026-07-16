begin;

do $$
begin
  if to_regclass('public.employee_secure_identifiers') is null then
    raise exception 'Beveiligde identificatietabel ontbreekt.';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'employees'
      and column_name in ('bsn_ciphertext', 'bsn_fingerprint')
  ) then
    raise exception 'BSN-kolommen staan nog op de algemene medewerkerstabel.';
  end if;
end
$$;

rollback;
