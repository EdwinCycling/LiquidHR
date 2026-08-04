-- Keep the read and write authorization predicates unchanged, but avoid a
-- FOR ALL write policy participating in SELECT evaluation.

drop policy if exists star_performer_assessment_tags_write on public.star_performer_assessment_tags;
create policy star_performer_assessment_tags_insert
  on public.star_performer_assessment_tags
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.star_performer_assessments as assessment
      where assessment.id = star_performer_assessment_tags.assessment_id
        and assessment.tenant_id = assessment.tenant_id
        and internal_security.current_user_has_permission(
          assessment.tenant_id,
          assessment.administration_id,
          'star-performer:write'
        )
    )
  );

create policy star_performer_assessment_tags_update
  on public.star_performer_assessment_tags
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.star_performer_assessments as assessment
      where assessment.id = star_performer_assessment_tags.assessment_id
        and assessment.tenant_id = assessment.tenant_id
        and internal_security.current_user_has_permission(
          assessment.tenant_id,
          assessment.administration_id,
          'star-performer:write'
        )
    )
  )
  with check (
    exists (
      select 1
      from public.star_performer_assessments as assessment
      where assessment.id = star_performer_assessment_tags.assessment_id
        and assessment.tenant_id = assessment.tenant_id
        and internal_security.current_user_has_permission(
          assessment.tenant_id,
          assessment.administration_id,
          'star-performer:write'
        )
    )
  );

create policy star_performer_assessment_tags_delete
  on public.star_performer_assessment_tags
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.star_performer_assessments as assessment
      where assessment.id = star_performer_assessment_tags.assessment_id
        and assessment.tenant_id = assessment.tenant_id
        and internal_security.current_user_has_permission(
          assessment.tenant_id,
          assessment.administration_id,
          'star-performer:write'
        )
    )
  );

drop policy if exists star_performer_assessments_write on public.star_performer_assessments;
create policy star_performer_assessments_insert
  on public.star_performer_assessments
  for insert
  to authenticated
  with check (
    internal_security.current_user_has_permission(
      star_performer_assessments.tenant_id,
      star_performer_assessments.administration_id,
      'star-performer:write'
    )
  );

create policy star_performer_assessments_update
  on public.star_performer_assessments
  for update
  to authenticated
  using (
    internal_security.current_user_has_permission(
      star_performer_assessments.tenant_id,
      star_performer_assessments.administration_id,
      'star-performer:write'
    )
  )
  with check (
    internal_security.current_user_has_permission(
      star_performer_assessments.tenant_id,
      star_performer_assessments.administration_id,
      'star-performer:write'
    )
  );

create policy star_performer_assessments_delete
  on public.star_performer_assessments
  for delete
  to authenticated
  using (
    internal_security.current_user_has_permission(
      star_performer_assessments.tenant_id,
      star_performer_assessments.administration_id,
      'star-performer:write'
    )
  );

drop policy if exists star_performer_tags_write on public.star_performer_tags;
create policy star_performer_tags_insert
  on public.star_performer_tags
  for insert
  to authenticated
  with check (
    internal_security.current_user_has_permission(
      star_performer_tags.tenant_id,
      null,
      'star-performer:write'
    )
  );

create policy star_performer_tags_update
  on public.star_performer_tags
  for update
  to authenticated
  using (
    internal_security.current_user_has_permission(
      star_performer_tags.tenant_id,
      null,
      'star-performer:write'
    )
  )
  with check (
    internal_security.current_user_has_permission(
      star_performer_tags.tenant_id,
      null,
      'star-performer:write'
    )
  );

create policy star_performer_tags_delete
  on public.star_performer_tags
  for delete
  to authenticated
  using (
    internal_security.current_user_has_permission(
      star_performer_tags.tenant_id,
      null,
      'star-performer:write'
    )
  );
