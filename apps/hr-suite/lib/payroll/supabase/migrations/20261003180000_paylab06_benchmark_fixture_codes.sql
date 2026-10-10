begin;

alter table public.payroll_arrangement_assignments
  drop constraint payroll_arrangement_assignments_fixture_code_check;

alter table public.payroll_arrangement_assignments
  add constraint payroll_arrangement_assignments_fixture_code_check
  check (fixture_code = any (array[
    'CAO-BENCH02-SCALE-STEP',
    'CAO-BENCH02-OPEN-BAND',
    'CAO-BENCH02-FREELY-NEGOTIATED',
    'CAO-BENCH02-KINDEROPVANG',
    'CAO-BENCH02-RETAIL-MODE',
    'CAO-BENCH02-OPEN-BAND-BENCHMARK',
    'CAO-BENCH02-CEO-BENCHMARK'
  ]::text[]));

comment on constraint payroll_arrangement_assignments_fixture_code_check on public.payroll_arrangement_assignments is
  'Explicit bounded synthetic fixture allowlist for CAO-BENCH02 Phase 1 and Phase 2 only.';

commit;
