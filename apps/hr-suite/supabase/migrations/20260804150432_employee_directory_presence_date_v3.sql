do $migration$
declare
  source text;
  old text := $old$'date', day_date,$old$;
  replacement text := $new$'date', day_date::date,$new$;
begin
  select pg_get_functiondef('public.get_employee_directory_detail(uuid,uuid,uuid,date)'::regprocedure) into source;
  if position(old in source) = 0 then
    raise exception 'employee directory date source not found';
  end if;
  execute replace(source, old, replacement);
end
$migration$;