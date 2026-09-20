do $migration$
declare
  source text;
  old_from text := $old$        from public.employment_schedules schedule$old$;
  new_from text := $new$        from (
          select schedule.*
          from public.employment_schedules schedule
          where schedule.tenant_id = requested_tenant_id and schedule.administration_id = requested_administration_id
            and schedule.employee_id = requested_employee_id and schedule.employment_id = employment_row.id
            and schedule.valid_from <= week_end and (schedule.valid_until is null or schedule.valid_until >= requested_week_start)
          order by schedule.valid_from desc
          limit 1
        ) schedule$new$;
  old_where text := $old$        where schedule.tenant_id = requested_tenant_id and schedule.administration_id = requested_administration_id
          and schedule.employee_id = requested_employee_id and schedule.employment_id = employment_row.id
          and schedule.valid_from <= week_end and (schedule.valid_until is null or schedule.valid_until >= requested_week_start)
        order by schedule.valid_from desc limit 1$old$;
begin
  select pg_get_functiondef('public.get_employee_directory_detail(uuid,uuid,uuid,date)'::regprocedure) into source;
  if position(old_from in source) = 0 or position(old_where in source) = 0 then
    raise exception 'employee directory fallback source not found';
  end if;
  execute replace(replace(source, old_from, new_from), old_where, '');
end
$migration$;