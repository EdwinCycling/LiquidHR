import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function migration(suffix: string): string {
  const directory = join(process.cwd(), 'supabase/migrations')
  const file = readdirSync(directory).find((candidate) => candidate.endsWith(`_${suffix}.sql`))
  expect(file, `migration ${suffix} ontbreekt`).toBeDefined()
  const path = join(directory, file ?? '')
  expect(existsSync(path)).toBe(true)
  return readFileSync(path, 'utf8').toLowerCase()
}

describe('guided recruitment migration contract', () => {
  it('legt de SEC-012 EXPAND-migratie vast zonder legacy submit-cutover', () => {
    const sql = migration('secure_public_recruitment_intake')
    expect(sql).toContain('create table public.recruitment_public_intake_proofs')
    expect(sql).toContain('alter table public.recruitment_public_intake_proofs enable row level security')
    expect(sql).toContain('recruitment_public_intake_proofs_deny_all')
    expect(sql).toContain('recruitment_public_intake_proofs_unconsumed_expiry_idx')
    expect(sql).toContain("set search_path = ''")
    expect(sql).toContain('request_count < 5')
    expect(sql).toContain("date_bin(interval '15 minutes'")
    expect(sql).toContain('for update skip locked')
    expect(sql).toContain('recruitment_claim_public_intake(uuid, text, text)')
    expect(sql).toContain('recruitment_cleanup_public_intake(integer)')
    expect(sql).toContain('grant execute on function public.recruitment_claim_public_intake(uuid, text, text) to service_role')
    expect(sql).toContain('grant execute on function public.recruitment_submit_public_application(uuid, text, jsonb, text, text) to anon, authenticated, service_role')
    expect(sql).toContain('grant execute on function public.recruitment_cleanup_public_intake(integer) to service_role')
    expect(sql).not.toMatch(/create\s+or\s+replace\s+function\s+public\.recruitment_submit_public_application\s*\(\s*requested_publication_id\s+uuid\s*,\s*requested_slug\s+text\s*,\s*requested_payload\s+jsonb\s*,\s*requested_intake_proof\s+text\s*\)/)
    expect(sql).not.toContain('revoke all on function public.recruitment_submit_public_application(uuid, text, jsonb, text)')
  })

  it('legt de SEC-012 CONTRACT-migratie vast als uitsluitend legacy cutover', () => {
    const sql = migration('disable_legacy_public_recruitment_submit')
    expect((sql.match(/create\s+or\s+replace\s+function/g) ?? [])).toHaveLength(1)
    expect(sql).toMatch(/create\s+or\s+replace\s+function\s+public\.recruitment_submit_public_application\s*\(\s*requested_publication_id\s+uuid\s*,\s*requested_slug\s+text\s*,\s*requested_payload\s+jsonb\s*,\s*requested_intake_proof\s+text\s*\)/)
    expect(sql).toContain("raise exception 'recruitment_public_proof_invalid'")
    expect(sql).toContain('revoke all on function public.recruitment_submit_public_application(uuid, text, jsonb, text) from public, anon, authenticated, service_role')
    expect(sql).not.toContain('requested_bucket_key_hash')
    expect(sql).not.toMatch(/create\s+table|alter\s+table|drop\s+table|create\s+index|insert\s+into|update\s+|delete\s+from|grant\s+/)
  })

  it('legt het applicatiegebonden dossier vast zonder unieke kandidaatmail', () => {
    const sql = migration('guided_recruitment_foundation')
    for (const table of [
      'recruitment_settings', 'recruitment_pipeline_stages', 'recruitment_vacancies', 'recruitment_vacancy_sections',
      'recruitment_vacancy_questions', 'recruitment_publications', 'recruitment_candidates', 'recruitment_applications',
      'recruitment_application_answers', 'recruitment_documents', 'recruitment_participations', 'recruitment_interviews',
      'recruitment_interview_participants', 'recruitment_library_items', 'recruitment_library_item_states',
      'recruitment_characteristics', 'recruitment_sets', 'recruitment_set_items', 'recruitment_assessments',
      'recruitment_assessment_scores', 'recruitment_events', 'recruitment_public_intake_limits',
    ]) expect(sql).toContain(`create table public.${table}`)
    expect(sql).not.toMatch(/unique\s*\([^)]*normalized_email/)
    expect(sql).toContain("check (terminal_outcome in ('afgewezen','aangenomen')")
    expect(sql).toContain("'recruitment_application'")
  })

  it('activeert RLS en expliciete grants op iedere exposed recruitmenttabel', () => {
    const sql = `${migration('guided_recruitment_foundation')}\n${migration('guided_recruitment_security_and_public_intake')}`
    for (const table of ['recruitment_candidates', 'recruitment_applications', 'recruitment_documents', 'recruitment_participations', 'recruitment_publications']) {
      expect(sql).toContain(`alter table public.${table} enable row level security`)
      expect(sql).toContain(`revoke all on table public.${table} from public, anon, authenticated`)
    }
    expect(sql).toContain('current_user_has_hr_group_permission')
    expect(sql).toContain('recruitment_participant_can_read_application')
  })

  it('seedt de module en alle tien canonieke permissions', () => {
    const sql = migration('guided_recruitment_foundation')
    expect(sql).toContain("'recruitment'")
    for (const permission of [
      'recruitment-vacancy:read', 'recruitment-vacancy:write', 'recruitment-vacancy:publish',
      'recruitment-candidate:read', 'recruitment-candidate:write', 'recruitment-assessment:read',
      'recruitment-assessment:write', 'recruitment-settings:manage', 'recruitment-participation:read',
      'recruitment-participation:write',
    ]) expect(sql).toContain(`'${permission}'`)
  })

  it('houdt anon write-only en documenten private/quarantined', () => {
    const sql = `${migration('guided_recruitment_foundation')}\n${migration('guided_recruitment_security_and_public_intake')}`
    expect(sql).toContain("'recruitment-documents'")
    expect(sql).toContain("'quarantined'")
    expect(sql).toContain("'clean'")
    expect(sql).toContain('recruitment_public_vacancy')
    expect(sql).toContain('recruitment_submit_public_application')
    expect(sql).toContain('grant execute')
    expect(sql).not.toContain('grant select on all tables in schema public to anon')
  })

  it('dwingt projecties, directe revocation, fase-minimum en retentieherberekening af', () => {
    const sql = migration('guided_recruitment_security_and_public_intake')
    expect(sql).toContain('recruitment_participant_application_projection')
    expect(sql).toContain('recruitment_pipeline_requires_active_stage')
    expect(sql).toContain('update_recruitment_retention_settings')
    expect(sql).toContain("set status = 'revoked'")
    expect(sql).toContain("'participantsrestored', false")
    expect(sql).toContain('returns table(document_id uuid)')
    expect(sql).not.toContain('returns table(storage_key text')
  })

  it('laat de canonical application-fix bij Applicant Detail en voegt geen pipeline-duplicate toe', () => {
    const fix = migration('guided_recruitment_public_intake_ambiguity_fix')
    const migrationFiles = readdirSync(join(process.cwd(), 'supabase/migrations'))
    const archiveFix = migration('guided_recruitment_archive_draft_fix')
    const hardening = migration('guided_recruitment_advisor_hardening')
    const replayFix = migration('guided_recruitment_idempotency_replay_fix')
    expect(fix).toContain('candidate_normalized_email')
    expect(migrationFiles).not.toContain('20260824183000_guided_recruitment_manual_application_ambiguity_fix.sql')
    expect(archiveFix).toContain('create or replace function public.publish_recruitment_vacancy')
    expect(archiveFix).toContain("declare effective_slug text;")
    expect(archiveFix).toContain("effective_slug := coalesce(requested_slug, 'vacancy-' || left(vacancy.id::text, 8));")
    expect(archiveFix).toContain('values (vacancy.tenant_id, vacancy.hr_group_id, vacancy.id, effective_slug, requested_status')
    expect(archiveFix).toContain('slug = effective_slug')
    expect(archiveFix).toContain("return jsonb_build_object('id', publication_id, 'status', requested_status, 'slug', effective_slug)")
    expect(archiveFix).toContain('case when requested_status = \'closed\' then timezone(\'utc\', now()) else null end')
    expect(archiveFix).toContain('case when requested_status = \'archived\' then timezone(\'utc\', now()) else null end')
    expect((archiveFix.match(/insert into public\.recruitment_publications/g) ?? []).length).toBe(1)
    expect((archiveFix.match(/update public\.recruitment_publications set/g) ?? []).length).toBe(1)
    expect(archiveFix).not.toMatch(/create\s+table|alter\s+table|grant\s+/)
    expect(hardening).toContain('recruitment_public_intake_limits_deny_all')
    expect(hardening).toContain('recruitment_applications_candidate_fk_idx')
    expect(replayFix).toContain("return replay_result || jsonb_build_object('idempotentreplay', true)")
    expect(replayFix).toContain('mutation_result')
  })
})
