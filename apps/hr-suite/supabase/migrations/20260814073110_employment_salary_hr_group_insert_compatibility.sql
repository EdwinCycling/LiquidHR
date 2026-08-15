-- Existing employment salary writers may omit hr_group_id. The BEFORE trigger
-- derives and validates it against the selected employment before NOT NULL is
-- enforced. An explicit NULL default keeps generated inserts backward compatible.
alter table public.employment_salaries
  alter column hr_group_id set default null;
