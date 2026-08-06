begin;

-- The employee foreign key is also used independently of the group-scoped
-- lookup, so it needs its own leftmost index column.
create index if not exists overtime_type_exceptions_employee_idx
  on public.overtime_type_exceptions (employee_id);

commit;
