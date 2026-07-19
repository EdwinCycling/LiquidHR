begin;

do $$
declare
  default_value text;
  enum_values text[];
begin
  select column_default into default_value
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'user_preferences'
    and column_name = 'week_numbering_system';

  select array_agg(enumlabel order by enumsortorder) into enum_values
  from pg_enum
  where enumtypid = 'public.week_numbering_system'::regtype;

  if default_value is null or default_value not like '%JANUARY_FIRST%' then
    raise exception 'De standaard weeknummering ontbreekt of is onjuist.';
  end if;

  if enum_values is distinct from array['JANUARY_FIRST', 'ISO'] then
    raise exception 'De weeknummering-enum is onvolledig.';
  end if;
end $$;

rollback;
