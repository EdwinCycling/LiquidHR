alter table public.leave_accrual_rules drop constraint if exists leave_accrual_rules_amount_valid;

alter table public.leave_accrual_rules
  add constraint leave_accrual_rules_amount_valid check (
    (accrual_basis = 'CONTRACT_HOURS' and accrual_amount is not null and accrual_amount >= 0 and accrual_rate is null)
    or (accrual_basis = 'WORKED_HOURS' and accrual_amount is null and accrual_rate is not null and accrual_rate >= 0)
  );
