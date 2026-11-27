BEGIN;

-- Remove unauthenticated table grants; row policies remain the authenticated read boundary.
REVOKE SELECT ON TABLE public.performance_review_draft_archives,
  public.performance_review_closures
FROM anon;

-- Cover each newly introduced foreign key flagged by the Core TEST advisor.
CREATE INDEX IF NOT EXISTS performance_review_closures_actor_idx
  ON public.performance_review_closures (actor_user_id);
CREATE INDEX IF NOT EXISTS performance_review_dossiers_additional_reviewer_fk_idx
  ON public.performance_review_dossiers (tenant_id, hr_group_id, additional_reviewer_employee_id);
CREATE INDEX IF NOT EXISTS performance_review_dossiers_additional_reviewer_released_by_idx
  ON public.performance_review_dossiers (additional_reviewer_released_by);
CREATE INDEX IF NOT EXISTS performance_review_draft_archives_archived_by_idx
  ON public.performance_review_draft_archives (archived_by);
CREATE INDEX IF NOT EXISTS performance_review_draft_archives_author_idx
  ON public.performance_review_draft_archives (author_user_id);
CREATE INDEX IF NOT EXISTS performance_review_role_flip_commands_actor_idx
  ON public.performance_review_role_flip_commands (actor_user_id);
CREATE INDEX IF NOT EXISTS performance_review_round_v2_commands_actor_idx
  ON public.performance_review_round_v2_commands (actor_user_id);
CREATE INDEX IF NOT EXISTS performance_review_round_v2_commands_round_idx
  ON public.performance_review_round_v2_commands (round_id);

-- Keep the existing V2 row predicates while evaluating auth.uid() once per statement.
DO $policy_initplan$
DECLARE
  existing_policy record;
BEGIN
  FOR existing_policy IN
    SELECT schemaname, tablename, policyname, qual
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('performance_review_submissions', 'performance_review_draft_archives')
      AND qual IS NOT NULL
      AND position('auth.uid()' IN qual) > 0
  LOOP
    EXECUTE format(
      'ALTER POLICY %I ON %I.%I USING (%s)',
      existing_policy.policyname,
      existing_policy.schemaname,
      existing_policy.tablename,
      replace(existing_policy.qual, 'auth.uid()', '(select auth.uid())')
    );
  END LOOP;
END;
$policy_initplan$;

COMMIT;