begin;

drop policy if exists talent_import_batches_insert on public.talent_import_batches;
create policy talent_import_batches_insert
on public.talent_import_batches for insert to authenticated
with check (
  created_by_user_id = (select auth.uid())
  and (select internal_security.current_user_has_permission(tenant_id, null, 'talent-import:manage'))
);

create index if not exists talent_import_batches_created_by_idx
  on public.talent_import_batches (created_by_user_id);
create index if not exists talent_import_batches_committed_by_idx
  on public.talent_import_batches (committed_by_user_id);
create index if not exists talent_import_batches_rolled_back_by_idx
  on public.talent_import_batches (rolled_back_by_user_id);

commit;
