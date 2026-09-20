do $migration$
declare
  source text;
  old text := $old$((floor((day_date - pattern_row.anchor_date)::numeric / 7)::integer % pattern_row.cycle_weeks) + 1)$old$;
  replacement text := $new$((floor((day_date::date - pattern_row.anchor_date)::numeric / 7)::integer % pattern_row.cycle_weeks) + 1)$new$;
begin
  select pg_get_functiondef('public.get_employee_directory_detail(uuid,uuid,uuid,date)'::regprocedure) into source;
  if position(old in source) = 0 then
    raise exception 'employee directory presence source not found';
  end if;
  execute replace(source, old, replacement);
end
$migration$;