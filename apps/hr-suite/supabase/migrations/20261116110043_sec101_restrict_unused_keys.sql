-- EXPAND: voeg uitsluitend afgeschermde sleutelinrichting en metadatafunctie toe.
BEGIN;
CREATE TABLE internal_security.sec101_provenance_public_key (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  armored_public_key text NOT NULL
);
REVOKE ALL ON internal_security.sec101_provenance_public_key FROM PUBLIC, anon, authenticated, service_role;
CREATE FUNCTION public.sec101_provenance_key_fingerprint()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT pg_catalog.encode(extensions.digest(extensions.dearmor(k.armored_public_key),'sha256'),'hex')
  FROM internal_security.sec101_provenance_public_key k WHERE auth.uid() IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.sec101_provenance_key_fingerprint() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sec101_provenance_key_fingerprint() TO authenticated;
CREATE FUNCTION public.sec101_profile_metadata(p_ids uuid[])
RETURNS TABLE(profile_id uuid, encrypted_payload text)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.id, pg_catalog.encode(extensions.pgp_pub_encrypt(
    pg_catalog.json_build_object('profileId',p.id,'actorUserId',auth.uid(),'tenantId',p.tenant_id,
      'hrGroupId',p.hr_group_id,'administrationId',p.administration_id,'employeeId',p.employee_id,
      'sourceReference',p.source_reference,'confirmedByUserId',p.confirmed_by_user_id)::text,
    extensions.dearmor(k.armored_public_key), 'cipher-algo=aes256,compress-algo=0'), 'base64')
  FROM public.employment_payroll_tax_profiles p
  CROSS JOIN internal_security.sec101_provenance_public_key k
  CROSS JOIN LATERAL (SELECT internal_security.current_user_has_permission(p.tenant_id,p.administration_id,'salary:read')
    AND EXISTS (SELECT 1 FROM public.user_access a JOIN public.management_roles r ON r.id=a.management_role_id
      AND r.code='TENANT_ADMIN' AND r.is_active AND r.deleted_at IS NULL AND (r.tenant_id IS NULL OR r.tenant_id=p.tenant_id)
      WHERE a.user_id=auth.uid() AND a.tenant_id=p.tenant_id AND a.is_active AND
        ((a.scope_type='TENANT' AND (a.hr_group_id IS NULL OR a.hr_group_id=p.hr_group_id)) OR
         (a.scope_type='ADMINISTRATION' AND a.administration_id=p.administration_id AND (a.hr_group_id IS NULL OR a.hr_group_id=p.hr_group_id))))) s(admin_ok)
  WHERE auth.uid() IS NOT NULL AND coalesce(pg_catalog.cardinality(p_ids),0) BETWEEN 1 AND 50
    AND p.id=ANY(p_ids) AND internal_security.has_hr_group_access(p.tenant_id,p.hr_group_id)
    AND (s.admin_ok OR (p.employee_id=internal_security.current_employee_id(p.tenant_id,p.hr_group_id)
      AND internal_security.current_employee_has_permission(p.tenant_id,p.hr_group_id,'self:salary:read')))
$$;
REVOKE ALL ON FUNCTION public.sec101_profile_metadata(uuid[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sec101_profile_metadata(uuid[]) TO authenticated;
COMMIT;
