import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { decrypt, generateKey, readMessage, readPrivateKey } from 'openpgp'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('SEC-101 fiscal column grants', () => {
  it('preserves required reads and blocks unused metadata, with reversible grants', async () => {
    expect(existsSync(new URL('../../supabase/migrations/20261116120304_sec101_contract_column_access.sql', import.meta.url))).toBe(false)
    const db = new PGlite({ extensions: { pgcrypto } })
    try {
      const profile = 'id,tenant_id,hr_group_id,administration_id,employee_id,employment_id,income_relationship_id,employment_income_relationship_id,residence_country_code,wage_tax_table,herleiding_code,time_period,regular_wage_only,full_period_only,has_special_situation,payroll_tax_credit_applies,source_classification,source_reference,effective_from,effective_to,version_number,supersedes_profile_id,confirmed_by_user_id,confirmed_at,created_at,idempotency_key'.split(',')
      const audit = 'id,tenant_id,hr_group_id,administration_id,employee_id,employment_id,income_relationship_id,tax_profile_id,action,audit_payload,recorded_at,request_key,actor_user_id'.split(',')
      const uuidColumns = new Set(['id','tenant_id','hr_group_id','administration_id','employee_id','confirmed_by_user_id'])
      await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE ROLE payfast_mss_projection_reader;
        CREATE SCHEMA auth; CREATE SCHEMA internal_security; CREATE SCHEMA extensions;
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.user_id',true),'')::uuid $$;
        CREATE FUNCTION internal_security.has_hr_group_access(uuid,uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
        CREATE FUNCTION internal_security.current_user_has_permission(uuid,uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.admin',true) = 'yes' $$;
        CREATE FUNCTION internal_security.current_employee_id(uuid,uuid) RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.employee_id',true),'')::uuid $$;
        CREATE FUNCTION internal_security.current_employee_has_permission(uuid,uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
        CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
        CREATE TABLE public.management_roles (id uuid,code text,is_active boolean,deleted_at timestamptz,tenant_id uuid);
        CREATE TABLE public.user_access (management_role_id uuid,user_id uuid,tenant_id uuid,is_active boolean,scope_type text,hr_group_id uuid,administration_id uuid);
        CREATE TABLE public.employment_payroll_tax_profiles (${profile.map(x => `${x} ${uuidColumns.has(x) ? 'uuid' : 'text'}`).join(',')}); CREATE TABLE public.employment_payroll_tax_profile_audit (${audit.map(x => `${x} text`).join(',')}); GRANT SELECT ON public.employment_payroll_tax_profiles, public.employment_payroll_tax_profile_audit TO anon, authenticated;
        GRANT SELECT (id,employee_id) ON public.employment_payroll_tax_profiles TO payfast_mss_projection_reader;`)
      const getAcls = () => db.query(`SELECT c.relname, a.attname, c.relacl::text, a.attacl::text FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped WHERE n.nspname='public' AND c.relname IN ('employment_payroll_tax_profiles','employment_payroll_tax_profile_audit') ORDER BY 1,2`)
      const originalAcls = (await getAcls()).rows
      const migration = readFileSync(new URL('../../supabase/migrations/20261116110043_sec101_restrict_unused_keys.sql', import.meta.url), 'utf8')
      const expandRollback = readFileSync(new URL('../../../../docs/quality/acceptance/runs/SEC101-EXPAND-ROLLBACK-DRAFT.sql', import.meta.url), 'utf8')
      const contractRollback = readFileSync(new URL('../../../../docs/quality/acceptance/runs/SEC101-CUTOVER-ROLLBACK-DRAFT.sql', import.meta.url), 'utf8')
      await db.exec(migration)
      expect((await getAcls()).rows).toEqual(originalAcls)
      const expand = await db.query<{ legacy: boolean }>(`SELECT has_column_privilege('authenticated','public.employment_payroll_tax_profiles','idempotency_key','SELECT') legacy`)
      expect(expand.rows[0]?.legacy).toBe(true)
      await db.exec(expandRollback)
      expect((await getAcls()).rows).toEqual(originalAcls)
      expect((await db.query<{ fn: string | null }>(`SELECT to_regprocedure('public.sec101_profile_metadata(uuid[])')::text fn`)).rows[0]?.fn).toBeNull()
      await db.exec(migration)
      const keys = await generateKey({ type: 'rsa', rsaBits: 2048, userIDs: [{ name: 'synthetic' }], format: 'armored' })
      await db.query('INSERT INTO internal_security.sec101_provenance_public_key(armored_public_key) VALUES ($1)', [keys.publicKey])
      const contract = readFileSync(new URL('../../supabase/migrations/20261119161917_sec101_contract_column_access.sql', import.meta.url), 'utf8')
      await db.exec(contract)
      const result = await db.query<{ allowed: boolean; blocked: boolean; anon: boolean }>(`SELECT has_column_privilege('authenticated','public.employment_payroll_tax_profiles','payroll_tax_credit_applies','SELECT') allowed, NOT has_column_privilege('authenticated','public.employment_payroll_tax_profiles','idempotency_key','SELECT') AND NOT has_column_privilege('authenticated','public.employment_payroll_tax_profiles','source_reference','SELECT') AND NOT has_column_privilege('authenticated','public.employment_payroll_tax_profiles','confirmed_by_user_id','SELECT') blocked, has_column_privilege('anon','public.employment_payroll_tax_profiles','id','SELECT') anon`)
      expect(result.rows[0]).toEqual({ allowed: true, blocked: true, anon: false })
      const auditResult = await db.query<{ allowed: boolean; blocked: boolean }>(`SELECT has_column_privilege('authenticated','public.employment_payroll_tax_profile_audit','audit_payload','SELECT') allowed, NOT has_column_privilege('authenticated','public.employment_payroll_tax_profile_audit','request_key','SELECT') AND NOT has_column_privilege('authenticated','public.employment_payroll_tax_profile_audit','actor_user_id','SELECT') blocked`)
      expect(auditResult.rows[0]).toEqual({ allowed: true, blocked: true })
      await db.exec(`INSERT INTO public.employment_payroll_tax_profiles (id,tenant_id,hr_group_id,administration_id,employee_id,source_reference,confirmed_by_user_id) VALUES
        ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000020','00000000-0000-4000-8000-000000000030','00000000-0000-4000-8000-000000000040','fixture','00000000-0000-4000-8000-000000000050');
        SELECT set_config('test.user_id','00000000-0000-4000-8000-000000000050',false); SELECT set_config('test.employee_id','00000000-0000-4000-8000-000000000040',false); SELECT set_config('test.admin','no',false);`)
      const self = await db.query<{ encrypted_payload: string }>(`SELECT encrypted_payload FROM public.sec101_profile_metadata(ARRAY['00000000-0000-4000-8000-000000000001'::uuid])`)
      const tooMany = await db.query<{ n: number }>(`SELECT count(*)::integer n FROM public.sec101_profile_metadata(ARRAY(SELECT '00000000-0000-4000-8000-000000000001'::uuid FROM generate_series(1,51)))`)
      expect(tooMany.rows[0]?.n).toBe(0)
      const privateKey = await readPrivateKey({ armoredKey: keys.privateKey })
      const keyFingerprint = await db.query<{ value: string }>('SELECT public.sec101_provenance_key_fingerprint() value')
      expect(keyFingerprint.rows[0]?.value).toBe(createHash('sha256').update(privateKey.toPublic().write()).digest('hex'))
      const message = await readMessage({ binaryMessage: Buffer.from(self.rows[0]!.encrypted_payload, 'base64') })
      const plaintext = await decrypt({ message, decryptionKeys: privateKey, format: 'utf8' })
      expect(JSON.parse(plaintext.data)).toMatchObject({ sourceReference: 'fixture', confirmedByUserId: '00000000-0000-4000-8000-000000000050', actorUserId: '00000000-0000-4000-8000-000000000050' })
      await db.exec('SET ROLE authenticated')
      const authenticatedSelf = await db.query<{ encrypted_payload: string }>(`SELECT encrypted_payload FROM public.sec101_profile_metadata(ARRAY['00000000-0000-4000-8000-000000000001'::uuid])`)
      expect(authenticatedSelf.rows[0]?.encrypted_payload).not.toContain('fixture')
      expect(authenticatedSelf.rows[0]?.encrypted_payload).not.toBe(self.rows[0]?.encrypted_payload)
      const again = await decrypt({ message: await readMessage({ binaryMessage: Buffer.from(authenticatedSelf.rows[0]!.encrypted_payload, 'base64') }), decryptionKeys: privateKey, format: 'utf8' })
      expect(JSON.parse(again.data)).toEqual(JSON.parse(plaintext.data))
      await expect(db.query('SELECT source_reference FROM public.employment_payroll_tax_profiles')).rejects.toThrow()
      await db.exec('RESET ROLE')
      await db.exec(`SELECT set_config('test.employee_id','00000000-0000-4000-8000-000000000041',false)`)
      const other = await db.query(`SELECT * FROM public.sec101_profile_metadata(ARRAY['00000000-0000-4000-8000-000000000001'::uuid])`)
      expect(other.rows).toHaveLength(0)
      await db.exec(`INSERT INTO public.management_roles VALUES ('00000000-0000-4000-8000-000000000060','TENANT_ADMIN',true,NULL,NULL);
        INSERT INTO public.user_access VALUES ('00000000-0000-4000-8000-000000000060','00000000-0000-4000-8000-000000000050','00000000-0000-4000-8000-000000000010',true,'ADMINISTRATION','00000000-0000-4000-8000-000000000020','00000000-0000-4000-8000-000000000030');
        SELECT set_config('test.admin','yes',false)`)
      const admin = await db.query<{ encrypted_payload: string }>(`SELECT encrypted_payload FROM public.sec101_profile_metadata(ARRAY['00000000-0000-4000-8000-000000000001'::uuid])`)
      expect(admin.rows).toHaveLength(1)
      await db.exec(`UPDATE public.user_access SET administration_id='00000000-0000-4000-8000-000000000031'`)
      const outside = await db.query(`SELECT * FROM public.sec101_profile_metadata(ARRAY['00000000-0000-4000-8000-000000000001'::uuid])`)
      expect(outside.rows).toHaveLength(0)
      const execute = await db.query<{ anon: boolean; auth: boolean }>(`SELECT has_function_privilege('anon','public.sec101_profile_metadata(uuid[])','EXECUTE') anon, has_function_privilege('authenticated','public.sec101_profile_metadata(uuid[])','EXECUTE') auth`)
      expect(execute.rows[0]).toEqual({ anon: false, auth: true })
      await db.exec(contractRollback)
      const rollback = await db.query<{ restored: boolean }>(`SELECT has_column_privilege('authenticated','public.employment_payroll_tax_profiles','idempotency_key','SELECT') restored`)
      expect(rollback.rows[0]?.restored).toBe(true)
      await db.exec(expandRollback)
      const beforeExpand = await db.query<{ fn: string | null; legacy: boolean }>(`SELECT to_regprocedure('public.sec101_profile_metadata(uuid[])')::text fn, has_table_privilege('authenticated','public.employment_payroll_tax_profiles','SELECT') legacy`)
      expect(beforeExpand.rows[0]).toEqual({ fn: null, legacy: true })
      expect((await getAcls()).rows).toEqual(originalAcls)
    } finally { await db.close() }
  })
})
