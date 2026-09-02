import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { ANALYSIS_SNAPSHOT_PAGE_SIZE, collectCompleteKeysetPages } from './analysis-snapshot-retrieval'

const source = readFileSync(new URL('./analysis-snapshot-retrieval.ts', import.meta.url), 'utf8')

describe('V2 snapshot retrieval seam', () => {
  it('uses the frozen server-only keyset page contract', () => {
    expect(ANALYSIS_SNAPSHOT_PAGE_SIZE).toBe(200)
    expect(source).toContain("createAdminClient()")
    expect(source).toContain("count: 'exact'")
    expect(source).toContain(".gt('id', cursor)")
    expect(source).toContain(".order('id', { ascending: true })")
    expect(source).not.toContain('.limit(500)')
    expect(source).toContain('ANALYSIS_RETRIEVAL_INCOMPLETE')
    expect(source).toContain('ANALYSIS_SCOPE_NOT_PROVABLE')
  })

  it('keeps scope predicates in employment and placement reads', () => {
    expect(source).toContain(".eq('tenant_id', authContext.tenantId)")
    expect(source).toContain(".eq('hr_group_id', hrGroupId)")
    expect(source).toContain(".eq('employment_id', row.id)")
    expect(source).toContain(".eq('direct_manager_id', actorEmployeeId)")
    expect(source).toContain(".is('employment_id', null)")
  })

  it('retrieves 501 rows across the 200/201 boundary without stitching in the browser', async () => {
    const allRows = Array.from({ length: 501 }, (_, index) => ({ id: `row-${String(index).padStart(4, '0')}` }))
    const calls: Array<{ readonly cursor: string | null; readonly pageSize: number }> = []
    const rows = await collectCompleteKeysetPages(allRows.length, async (cursor, pageSize) => {
      calls.push({ cursor, pageSize })
      const start = cursor === null ? 0 : allRows.findIndex((row) => row.id > cursor)
      return { rows: allRows.slice(start, start + pageSize), error: null }
    })
    expect(rows).toHaveLength(501)
    expect(calls.map((call) => call.pageSize)).toEqual([200, 200, 200])
    expect(calls.map((call) => call.cursor)).toEqual([null, 'row-0199', 'row-0399'])
  })

  it('fails closed on duplicate/regressing cursors, short incomplete pages and source errors', async () => {
    await expect(collectCompleteKeysetPages(2, async () => ({ rows: [{ id: 'row-a' }, { id: 'row-a' }], error: null }))).rejects.toMatchObject({ code: 'ANALYSIS_RETRIEVAL_INCOMPLETE' })
    await expect(collectCompleteKeysetPages(401, async (cursor) => ({ rows: cursor === null ? Array.from({ length: 200 }, (_, index) => ({ id: `row-${index}` })) : [{ id: 'row-000' }], error: null }))).rejects.toMatchObject({ code: 'ANALYSIS_RETRIEVAL_INCOMPLETE' })
    await expect(collectCompleteKeysetPages(1, async () => ({ rows: [], error: null }))).rejects.toMatchObject({ code: 'ANALYSIS_RETRIEVAL_INCOMPLETE' })
    await expect(collectCompleteKeysetPages(1, async () => ({ rows: [], error: new Error('source failed') }))).rejects.toMatchObject({ code: 'ANALYSIS_RETRIEVAL_INCOMPLETE' })
  })
})
