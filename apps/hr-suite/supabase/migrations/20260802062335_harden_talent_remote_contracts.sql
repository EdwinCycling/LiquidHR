-- Harden the remote Talent completion contract after the test catalog was seeded.
-- Keep the existing canonical uniqueness index and collapse the extra Talent read policy.

drop index if exists public.talent_capabilities_tenant_type_name_normalized_key;

drop policy if exists star_performer_tags_talent_read on public.star_performer_tags;
drop policy if exists star_performer_tags_read on public.star_performer_tags;
create policy star_performer_tags_read
on public.star_performer_tags
for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'star-performer:read'))
  or (select internal_security.current_user_has_permission(tenant_id, null, 'talent:read'))
  or (select internal_security.current_user_has_permission(tenant_id, null, 'talent:manage'))
);

revoke execute on function internal_security.audit_talent_capability_tag_relation() from public, anon, authenticated;
revoke execute on function internal_security.lock_talent_level_model_on_content_use() from public, anon, authenticated;
revoke execute on function internal_security.normalize_talent_capability_name() from public, anon, authenticated;
revoke execute on function internal_security.prevent_talent_category_delete_when_used() from public, anon, authenticated;
revoke execute on function internal_security.validate_talent_capability() from public, anon, authenticated;
revoke execute on function internal_security.validate_talent_capability_level_content() from public, anon, authenticated;
revoke execute on function internal_security.validate_talent_profile_requirement() from public, anon, authenticated;
