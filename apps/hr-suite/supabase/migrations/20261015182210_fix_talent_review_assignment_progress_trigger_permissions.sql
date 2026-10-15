begin;

-- Derived assignment counts are updated only by the scores trigger. Run this
-- trigger with its postgres-owned privileges while retaining a pinned path.
alter function internal_security.sync_talent_review_assignment_progress()
  security definer;
alter function internal_security.sync_talent_review_assignment_progress()
  set search_path = '';
revoke all on function internal_security.sync_talent_review_assignment_progress()
  from public, anon, authenticated;

commit;
