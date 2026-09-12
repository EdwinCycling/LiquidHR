import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const auditTimelineSql = readFileSync('supabase/migrations/20260912072624_contract_change_audit_and_timeline.sql', 'utf8')
const statusSql = readFileSync('supabase/migrations/20260912074130_repair_contract_terminal_selection_status.sql', 'utf8')

describe('employment contract mutation migration contracts', () => {
  it('keeps contract edits on the existing invoker and RLS boundary', () => {
    expect(auditTimelineSql).toContain("CONTRACT_FUNCTION_MUST_REMAIN_INVOKER")
    expect(auditTimelineSql).toContain("CONTRACT_FUNCTION_MUST_REMAIN_VOLATILE")
    expect(auditTimelineSql).toContain("revoke all on function public.manage_employment_contract(uuid, uuid, jsonb)\nfrom public, anon;")
    expect(auditTimelineSql).toContain("grant execute on function public.manage_employment_contract(uuid, uuid, jsonb)\nto authenticated;")
    expect(auditTimelineSql).not.toContain('create policy')
    expect(auditTimelineSql).not.toContain('security definer')
  })

  it('records an edit reason and reconciles terminal dependent periods', () => {
    expect(auditTimelineSql).toContain("raise exception ''CONTRACT_CHANGE_REASON_REQUIRED''")
    expect(auditTimelineSql).toContain('insert into public.employment_change_sets')
    expect(auditTimelineSql).toContain("array[''CONTRACT'']")
    expect(auditTimelineSql).toContain('audit_employment_contracts')
    expect(auditTimelineSql).toContain('or link.valid_until = current_contract.ends_on')
    expect(auditTimelineSql).toContain('or schedule.valid_until = current_contract.ends_on')
    expect(auditTimelineSql).toContain('or salary.valid_until = current_contract.ends_on')
  })

  it('marks the same transaction applied only after the domain mutation returns', () => {
    expect(statusSql).toContain('update public.employment_change_sets')
    expect(statusSql).toContain("set status = ''APPLIED''")
    expect(statusSql).toContain('where id = change_id')
    expect(statusSql).toContain('return resulting_contract_id;')
    expect(statusSql).toContain("CONTRACT_FUNCTION_MUST_REMAIN_INVOKER")
    expect(statusSql).toContain("CONTRACT_FUNCTION_MUST_REMAIN_VOLATILE")
  })
})
