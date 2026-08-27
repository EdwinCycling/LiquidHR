import { describe, expect, it } from 'vitest'

// @ts-expect-error The fixture helper is intentionally executable JavaScript because it runs with Node --env-file.
import { R5_CLEANUP_TABLE_ORDER, R5_DATASET_CONTRACT, R5_DEFINITION_KEYS, R5_PREFIX, buildCleanupSql, hasR5Prefix, parseMode } from './r5-shared-test-dataset.mjs'

describe('R5 shared TEST dataset contract', () => {
  it('keeps the requested categories and certified definition keys explicit', () => {
    expect(R5_PREFIX).toBe('R5-TEST')
    expect(R5_DATASET_CONTRACT).toEqual(expect.arrayContaining([
      'OPEN_HR_QUEUE_UNCLAIMED',
      'CLAIMED_WORK_ITEM',
      'EMPLOYEE_DOCUMENT_ACKNOWLEDGEMENT',
      'COMPLETED_PROCESS',
      'REJECTED_APPROVAL_FLOW',
      'REQUEST_CHANGES_FLOW',
      'BLOCKED_UNRESOLVED_ASSIGNMENT',
      'UPCOMING_DEADLINE',
      'OVERDUE_DEADLINE',
      'SUCCESSFUL_PROCESS_OUTPUT',
      'DRAFT_PROCESS_DEFINITION',
      'RETIRED_PROCESS_DEFINITION',
    ]))
    const definitionKeys = [R5_DEFINITION_KEYS.internalTransfer, R5_DEFINITION_KEYS.documentAcknowledgement, R5_DEFINITION_KEYS.overdue, R5_DEFINITION_KEYS.draft, R5_DEFINITION_KEYS.retired].map(String)
    expect(definitionKeys).toHaveLength(5)
    expect(definitionKeys.every((key) => key.startsWith('r5-test-'))).toBe(true)
  })

  it('recognises only the shared dataset prefix', () => {
    expect(hasR5Prefix('R5-TEST — item')).toBe(true)
    expect(hasR5Prefix('OTHER — item')).toBe(false)
    expect(hasR5Prefix(null)).toBe(false)
  })

  it('supports setup, readback and cleanup modes', () => {
    expect(parseMode([])).toBe('setup')
    expect(parseMode(['readback'])).toBe('readback')
    expect(parseMode(['cleanup'])).toBe('cleanup')
    expect(() => parseMode(['drop-all'])).toThrow('Invalid mode')
  })

  it('keeps hard cleanup child-first and dataset-scoped', () => {
    expect(R5_CLEANUP_TABLE_ORDER.indexOf('process_events')).toBeLessThan(R5_CLEANUP_TABLE_ORDER.indexOf('process_instances'))
    expect(R5_CLEANUP_TABLE_ORDER.indexOf('process_form_response_revisions')).toBeLessThan(R5_CLEANUP_TABLE_ORDER.indexOf('process_form_responses'))
    expect(R5_CLEANUP_TABLE_ORDER.indexOf('employee_document_acknowledgements')).toBeLessThan(R5_CLEANUP_TABLE_ORDER.indexOf('employee_documents'))
    expect(R5_CLEANUP_TABLE_ORDER).toEqual(expect.arrayContaining(['process_definitions', 'process_instances', 'employee_documents', 'reminders']))
  })

  it('generates exact scoped SQL rather than broad table deletes', () => {
    const emptyRows = Object.fromEntries([
      'acknowledgements', 'reminderDeliveries', 'domainCommits', 'notes', 'responseRevisions', 'formResponses',
      'events', 'candidates', 'outputs', 'jobs', 'workItems', 'steps', 'employeeSubjects', 'employmentSubjects',
      'recipeActivations', 'versions', 'drafts', 'documentAudiences', 'documents', 'reminderRecipients',
      'reminderTargets', 'reminderTargetRules',
    ].map((key) => [key, []]))
    const rows = {
      ...emptyRows,
      ids: {
        definitionIds: ['5a3f96c5-45db-2cd9-5aff-971eee7eab44'],
        instanceIds: ['4a3f96c5-45db-2cd9-5aff-971eee7eab44'],
        documentIds: ['6a3f96c5-45db-2cd9-5aff-971eee7eab44'],
        reminderIds: [],
      },
    }
    const canonical = {
      tenantId: '07249eb9-545c-883b-b26b-d52f83b4f4a1',
      hrGroupId: '6ba6f1df-e376-40f2-abff-ffdf000172e1',
      administrationId: '8483abc9-f275-c80b-5a23-fedc54ce9f0a',
    }
    const sql = buildCleanupSql(rows, canonical)
    expect(sql).toContain('begin;')
    expect(sql).toContain('set local session_replication_role = replica;')
    expect(sql).toContain("delete from public.process_instances where tenant_id = '07249eb9-545c-883b-b26b-d52f83b4f4a1' and hr_group_id = '6ba6f1df-e376-40f2-abff-ffdf000172e1'")
    expect(sql).toContain("delete from public.employee_documents where tenant_id = '07249eb9-545c-883b-b26b-d52f83b4f4a1' and administration_id = '8483abc9-f275-c80b-5a23-fedc54ce9f0a'")
    expect(sql).not.toContain('delete from public.process_instances;')
    expect(sql).toContain('commit;')
  })
})
