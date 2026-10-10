-- Index every foreign-key column set introduced by immutable pension
-- arrangement versioning. These support parent deletes/updates and scoped reads.
CREATE INDEX pension_arrangement_versions_arrangement_scope_idx
  ON public.pension_arrangement_versions (pension_arrangement_id, tenant_id, hr_group_id, administration_id);
CREATE INDEX pension_arrangement_versions_predecessor_scope_idx
  ON public.pension_arrangement_versions (supersedes_version_id, tenant_id, hr_group_id, administration_id, pension_arrangement_id);
CREATE INDEX pension_arrangement_versions_created_by_idx
  ON public.pension_arrangement_versions (created_by_user_id);

CREATE INDEX pension_arrangement_version_tiers_version_scope_idx
  ON public.pension_arrangement_version_tiers (pension_arrangement_version_id, tenant_id, hr_group_id, administration_id, pension_arrangement_id);

CREATE INDEX pension_arrangement_version_audit_version_scope_idx
  ON public.pension_arrangement_version_audit (pension_arrangement_version_id, tenant_id, hr_group_id, administration_id, pension_arrangement_id);
CREATE INDEX pension_arrangement_version_audit_predecessor_scope_idx
  ON public.pension_arrangement_version_audit (supersedes_version_id, tenant_id, hr_group_id, administration_id, pension_arrangement_id);
CREATE INDEX pension_arrangement_version_audit_actor_idx
  ON public.pension_arrangement_version_audit (actor_user_id);
