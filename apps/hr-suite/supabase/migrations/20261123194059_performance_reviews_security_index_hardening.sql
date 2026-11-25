-- Performance Reviews: expliciete interne toegang en ontbrekende FK-indexen.
-- Deze migration is uitsluitend additief en veilig opnieuw controleerbaar.

create index if not exists performance_review_acknowledgements_actor_idx
  on public.performance_review_acknowledgements (actor_user_id);
create index if not exists performance_review_appraisal_links_item_idx
  on public.performance_review_appraisal_links (tenant_id, appraisal_item_id);
create index if not exists performance_review_appraisal_links_created_by_idx
  on public.performance_review_appraisal_links (created_by);
create index if not exists performance_review_attachments_uploaded_by_idx
  on public.performance_review_attachments (uploaded_by);
create index if not exists performance_review_audit_events_dossier_idx
  on public.performance_review_audit_events (tenant_id, dossier_id);
create index if not exists performance_review_audit_events_round_idx
  on public.performance_review_audit_events (tenant_id, round_id);
create index if not exists performance_review_dossiers_administration_idx
  on public.performance_review_dossiers (tenant_id, hr_group_id, administration_id);
create index if not exists performance_review_dossiers_employee_scope_idx
  on public.performance_review_dossiers (tenant_id, hr_group_id, employee_id);
create index if not exists performance_review_dossiers_reviewer_scope_idx
  on public.performance_review_dossiers (tenant_id, hr_group_id, reviewer_employee_id);
create index if not exists performance_review_dossiers_round_scope_idx
  on public.performance_review_dossiers (tenant_id, hr_group_id, round_id);
create index if not exists performance_review_private_notes_author_idx
  on public.performance_review_private_notes (author_user_id);
create index if not exists performance_review_rounds_created_by_idx
  on public.performance_review_rounds (created_by);
create index if not exists performance_review_submissions_author_idx
  on public.performance_review_submissions (author_user_id);

drop policy if exists performance_review_submissions_select
  on public.performance_review_submissions;
create policy performance_review_submissions_select
  on public.performance_review_submissions
  for select to authenticated
  using (
    exists (
      select 1
      from public.performance_review_dossiers d
      where d.tenant_id = performance_review_submissions.tenant_id
        and d.id = performance_review_submissions.dossier_id
        and (
          (performance_review_submissions.author_user_id = (select auth.uid())
            and performance_review_submissions.submitted_at is null)
          or (
            performance_review_submissions.submitted_at is not null
            and internal_security.performance_review_can_read_dossier(
              d.tenant_id, d.hr_group_id, d.employee_id, d.reviewer_employee_id
            )
          )
        )
    )
  );

-- Audit- en idempotencyrecords zijn uitsluitend schrijfbaar/leesbaar via
-- de afgeschermde SECURITY DEFINER-commandofuncties.
revoke all on table public.performance_review_audit_events
  from public, anon, authenticated;
revoke all on table public.performance_review_command_results
  from public, anon, authenticated;

drop policy if exists performance_review_audit_events_deny_direct
  on public.performance_review_audit_events;
create policy performance_review_audit_events_deny_direct
  on public.performance_review_audit_events
  for all to authenticated
  using (false)
  with check (false);

drop policy if exists performance_review_command_results_deny_direct
  on public.performance_review_command_results;
create policy performance_review_command_results_deny_direct
  on public.performance_review_command_results
  for all to authenticated
  using (false)
  with check (false);
