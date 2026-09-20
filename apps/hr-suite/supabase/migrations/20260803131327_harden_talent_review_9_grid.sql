-- Revoke Supabase default table grants explicitly; RLS is not a replacement for table privileges.
revoke all on public.talent_review_campaigns, public.talent_review_assignments, public.talent_review_assignment_members, public.talent_review_scores from public, anon;
grant select, insert, update on public.talent_review_campaigns to authenticated;
grant select, update on public.talent_review_assignments to authenticated;
grant select on public.talent_review_assignment_members to authenticated;
grant select, insert, update on public.talent_review_scores to authenticated;
