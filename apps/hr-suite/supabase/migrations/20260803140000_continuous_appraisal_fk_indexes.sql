begin;

-- Covering indexes for the audit/user and author foreign keys of the timeline.
create index if not exists continuous_appraisal_items_created_by_user_idx
  on public.continuous_appraisal_items (created_by_user_id);
create index if not exists continuous_appraisal_comments_author_idx
  on public.continuous_appraisal_item_comments (tenant_id, author_employee_id);
create index if not exists continuous_appraisal_comments_author_user_idx
  on public.continuous_appraisal_item_comments (author_user_id);

commit;
