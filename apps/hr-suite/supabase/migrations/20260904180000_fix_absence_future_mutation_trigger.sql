begin;

create or replace function internal_security.prevent_future_absence_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, internal_security, pg_temp
as $$
begin
  if tg_table_name = 'absence_cases' then
    if new.first_absence_on > current_date
       or new.effective_clock_start_on > current_date then
      raise exception 'ABSENCE_DATE_IN_FUTURE' using errcode = '22023';
    end if;
  elsif tg_table_name = 'absence_spells' then
    if new.started_on > current_date
       or (new.recovered_on is not null and new.recovered_on > current_date) then
      raise exception 'ABSENCE_DATE_IN_FUTURE' using errcode = '22023';
    end if;
  elsif tg_table_name = 'absence_capacity_changes' then
    if new.effective_on > current_date then
      raise exception 'ABSENCE_DATE_IN_FUTURE' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

commit;
