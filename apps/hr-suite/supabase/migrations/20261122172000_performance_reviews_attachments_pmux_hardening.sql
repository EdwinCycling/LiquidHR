begin;

-- Attachment metadata is released only when the manager submission is final.
-- The storage object remains private; every signed URL is issued after the
-- actor and release state have been checked again by the application/RLS.
alter table public.performance_review_attachments
  add column if not exists released_at timestamptz;

create or replace function public.performance_review_release_attachments()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.kind = 'MANAGER' and new.submitted_at is not null then
    if tg_op = 'INSERT' or old.submitted_at is null then
      update public.performance_review_attachments
         set released_at = coalesce(released_at, new.submitted_at)
       where tenant_id = new.tenant_id
         and dossier_id = new.dossier_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists performance_review_release_attachments on public.performance_review_submissions;
create trigger performance_review_release_attachments
after insert or update of submitted_at on public.performance_review_submissions
for each row execute function public.performance_review_release_attachments();

create or replace function public.delete_performance_review_attachment(requested_attachment uuid)
returns public.performance_review_attachments
language plpgsql
security definer
set search_path = public, internal_security, auth, pg_temp
as $$
declare
  attachment public.performance_review_attachments;
  dossier public.performance_review_dossiers;
  review_round public.performance_review_rounds;
  actor uuid;
begin
  select a.* into attachment
    from public.performance_review_attachments a
   where a.id = requested_attachment;
  if attachment.id is null then
    raise exception 'PERFORMANCE_ATTACHMENT_NOT_FOUND';
  end if;
  select d.* into dossier
    from public.performance_review_dossiers d
   where d.tenant_id = attachment.tenant_id
     and d.id = attachment.dossier_id;
  if dossier.id is null then
    raise exception 'PERFORMANCE_ATTACHMENT_NOT_FOUND';
  end if;
  -- Keep the same parent-first order as every other dossier mutation so a
  -- round close/cancel cannot race attachment deletion.
  select r.* into review_round
    from public.performance_review_rounds r
   where r.tenant_id = dossier.tenant_id
     and r.id = dossier.round_id
   for update;
  select d.* into dossier
    from public.performance_review_dossiers d
   where d.tenant_id = attachment.tenant_id
     and d.id = attachment.dossier_id
   for update;
  select a.* into attachment
    from public.performance_review_attachments a
   where a.id = requested_attachment
   for update;
  actor := internal_security.current_employee_id(dossier.tenant_id, dossier.hr_group_id);
  if dossier.id is null or actor is distinct from dossier.reviewer_employee_id
     or dossier.phase <> 'WAITING_MANAGER'
     or not internal_security.can_manage_employee(dossier.employee_id, 'performance-review:team-submit') then
    raise exception 'PERFORMANCE_ATTACHMENT_FORBIDDEN';
  end if;
  if review_round.id is null or review_round.status <> 'ACTIVE' then
    raise exception 'PERFORMANCE_ROUND_NOT_ACTIVE';
  end if;
  delete from public.performance_review_command_results
   where tenant_id = attachment.tenant_id
     and actor_user_id = auth.uid()
     and operation = 'ATTACHMENT_CREATED'
     and result_id = attachment.id;
  delete from public.performance_review_attachments
   where tenant_id = attachment.tenant_id and id = attachment.id;
  insert into public.performance_review_audit_events (tenant_id, dossier_id, action)
  values (attachment.tenant_id, attachment.dossier_id, 'ATTACHMENT_REMOVED');
  return attachment;
end;
$$;

revoke all on function public.performance_review_release_attachments() from public, anon, authenticated;
revoke all on function public.delete_performance_review_attachment(uuid) from public, anon;
grant execute on function public.delete_performance_review_attachment(uuid) to authenticated;

drop policy if exists performance_review_attachments_select on public.performance_review_attachments;
create policy performance_review_attachments_select on public.performance_review_attachments
for select to authenticated using (
  exists (
    select 1
      from public.performance_review_dossiers d
     where d.tenant_id = performance_review_attachments.tenant_id
       and d.id = performance_review_attachments.dossier_id
       and internal_security.performance_review_can_read_dossier(
         d.tenant_id, d.hr_group_id, d.employee_id, d.reviewer_employee_id
       )
       and (
         d.reviewer_employee_id = internal_security.current_employee_id(d.tenant_id, d.hr_group_id)
         or performance_review_attachments.released_at is not null
       )
  )
);

drop policy if exists performance_review_storage_select on storage.objects;
create policy performance_review_storage_select on storage.objects
for select to authenticated using (
  bucket_id = 'performance-review-attachments' and exists (
    select 1
      from public.performance_review_attachments a
      join public.performance_review_dossiers d
        on d.tenant_id = a.tenant_id and d.id = a.dossier_id
     where a.storage_key = storage.objects.name
       and internal_security.performance_review_can_read_dossier(
         d.tenant_id, d.hr_group_id, d.employee_id, d.reviewer_employee_id
       )
       and (
         d.reviewer_employee_id = internal_security.current_employee_id(d.tenant_id, d.hr_group_id)
         or a.released_at is not null
       )
  )
);

-- The upload service first writes the private object and registers its metadata
-- in the same HTTP request. Authorize the narrowly scoped dossier path so the
-- initial object can be written before the metadata row exists.
drop policy if exists performance_review_storage_insert on storage.objects;
create policy performance_review_storage_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'performance-review-attachments'
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]+$'
  and exists (
    select 1 from public.performance_review_dossiers d
    join public.performance_review_rounds r on r.tenant_id = d.tenant_id and r.id = d.round_id
    where d.tenant_id::text = split_part(storage.objects.name, '/', 1)
      and d.id::text = split_part(storage.objects.name, '/', 2)
      and r.status = 'ACTIVE' and d.phase = 'WAITING_MANAGER'
      and d.reviewer_employee_id = internal_security.current_employee_id(d.tenant_id, d.hr_group_id)
      and coalesce(internal_security.can_manage_employee(d.employee_id, 'performance-review:team-submit'), false)
  )
);

-- The delete RPC removes the metadata row before the service removes the
-- object. Recheck the same current reviewer scope against the still existing
-- dossier and the tenant/dossier-prefixed storage key.
drop policy if exists performance_review_storage_delete on storage.objects;
create policy performance_review_storage_delete on storage.objects
for delete to authenticated using (
  bucket_id = 'performance-review-attachments'
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]+$'
  and exists (
    select 1 from public.performance_review_dossiers d
    join public.performance_review_rounds r on r.tenant_id = d.tenant_id and r.id = d.round_id
    where d.tenant_id::text = split_part(storage.objects.name, '/', 1)
      and d.id::text = split_part(storage.objects.name, '/', 2)
      and r.status = 'ACTIVE' and d.phase = 'WAITING_MANAGER'
      and d.reviewer_employee_id = internal_security.current_employee_id(d.tenant_id, d.hr_group_id)
      and coalesce(internal_security.can_manage_employee(d.employee_id, 'performance-review:team-submit'), false)
  )
);

commit;
