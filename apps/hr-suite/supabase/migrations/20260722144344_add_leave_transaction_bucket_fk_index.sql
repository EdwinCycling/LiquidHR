create index if not exists leave_accrual_transactions_bucket_employee_fk_idx
  on public.leave_accrual_transactions (tenant_id, administration_id, employee_id, employment_id, leave_type_id, bucket_id);
