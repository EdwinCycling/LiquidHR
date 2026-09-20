begin;

-- The existing index enforced the same non-null uniqueness but was partial.
-- The Leave RPCs use the standard (bucket_id, source_key) conflict target;
-- replacing the index preserves the data invariant while making that target
-- valid. Multiple NULL source keys remain allowed by PostgreSQL uniqueness.
drop index if exists public.leave_accrual_transactions_source_key;
create unique index leave_accrual_transactions_source_key
  on public.leave_accrual_transactions (bucket_id, source_key);

commit;

