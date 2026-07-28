alter type public.leave_accrual_basis add value if not exists 'AGE_SENIORITY';

alter table public.leave_types
  add column if not exists allow_limit_overrun boolean not null default false,
  add column if not exists pin_in_calendar boolean not null default false,
  add column if not exists requires_manager_approval boolean not null default false,
  add column if not exists notify_manager_on_request boolean not null default false,
  add column if not exists requires_manager_approval_on_cancellation boolean not null default false;
