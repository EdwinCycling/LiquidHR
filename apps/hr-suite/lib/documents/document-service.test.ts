import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, requirePermission } = vi.hoisted(() => ({
  createClient: vi.fn(),
  requirePermission: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/permissions', () => ({
  AuthorizationError: class AuthorizationError extends Error { readonly status = 403 },
  requirePermission,
}))
vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import type { createClient as createServerClient } from '@/lib/supabase/server'
import { createDocumentDownload, createDocumentPreview, DocumentServiceError, listEmployeeDocuments } from './document-service'

type SupabaseServerClient = Awaited<ReturnType<typeof createServerClient>>

const employeeId = '11111111-1111-4111-8111-111111111111'
const documentId = '22222222-2222-4222-8222-222222222222'
const storedTextDocument = {
  storage_key: 'd01/note.txt',
  original_filename: 'D01-note.txt',
  content_type: 'text/plain',
  file_size: 20,
}

class DocumentQuery {
  selectedColumns = ''

  constructor(private readonly rows: object[]) {}

  select(columns: string) { this.selectedColumns = columns; return this }
  eq() { return this }
  is() { return this }
  order() { return this }
  limit() { return Promise.resolve({ data: this.rows, error: null }) }
  maybeSingle() { return Promise.resolve({ data: this.rows[0] ?? null, error: null }) }
}

describe('employee document custom-field read boundary', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reads actor-filtered custom fields through the RPC without selecting the restricted column', async () => {
    const query = new DocumentQuery([{
      id: documentId,
      category_id: '33333333-3333-4333-8333-333333333333',
      title: 'D01 contract',
      description: null,
      tags: [],
      original_filename: 'D01-contract.pdf',
      content_type: 'application/pdf',
      file_size: 100,
      checksum_sha256: 'a'.repeat(64),
      added_by_user_id: '44444444-4444-4444-8444-444444444444',
      expires_on: null,
      created_at: '2026-09-24T10:00:00.000Z',
      deleted_at: null,
      deleted_by_user_id: null,
      delete_reason: null,
      expiry_reminder_id: null,
      document_categories: { code: 'D01', name: 'D01', requires_salary_permission: false },
      document_audiences: [],
    }])
    const rpc = vi.fn(async (name: string) => {
      if (name === 'can_access_employee_dossier') return { data: true, error: null }
      if (name === 'get_accessible_employee_document_custom_fields') return {
        data: [{
          document_id: documentId,
          custom_fields: { d01_reference: 'D01-REF-001' },
          labels_nl: { d01_reference: 'Referentie' },
          labels_en: { d01_reference: 'Reference' },
        }],
        error: null,
      }
      if (name === 'get_deleted_employee_documents_for_restore') return { data: [], error: null }
      throw new Error(`Unexpected RPC: ${name}`)
    })

    createClient.mockResolvedValue({ from: vi.fn(() => query), rpc } as unknown as SupabaseServerClient)

    const documents = await listEmployeeDocuments(employeeId)

    expect(query.selectedColumns.split(',').map((column) => column.trim())).not.toContain('custom_fields')
    expect(rpc).toHaveBeenCalledWith('get_accessible_employee_document_custom_fields', { requested_document_ids: [documentId] })
    expect(documents[0]?.custom_fields).toEqual({ d01_reference: 'D01-REF-001' })
    expect(documents[0]?.custom_fields).not.toHaveProperty('d01_internal_context')
    expect(documents[0]?.custom_field_labels_nl).toEqual({ d01_reference: 'Referentie' })
  })
})

describe('employee document inline preview', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('proxies an authorized safe file through a same-project, non-cacheable response body', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://storage.example')
    const signedUrl = 'https://storage.example/storage/v1/object/sign/employee-documents/d01/note.txt?token=test-only'
    const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl }, error: null })
    const storageFrom = vi.fn(() => ({ createSignedUrl }))
    const query = new DocumentQuery([storedTextDocument])
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    createClient.mockResolvedValue({ from: vi.fn(() => query), rpc, storage: { from: storageFrom } } as unknown as SupabaseServerClient)
    requirePermission.mockResolvedValue({})
    const fetchMock = vi.fn().mockResolvedValue(new Response('LiquidHR D01 preview', { headers: { 'content-type': 'text/plain; charset=utf-8', 'content-length': '20' } }))
    vi.stubGlobal('fetch', fetchMock)

    const preview = await createDocumentPreview(employeeId, documentId)

    expect(requirePermission).toHaveBeenCalledWith('document:read', employeeId)
    expect(rpc).toHaveBeenCalledWith('can_access_employee_dossier', { requested_employee_id: employeeId, requested_permission: 'document:read' })
    expect(createSignedUrl).toHaveBeenCalledWith('d01/note.txt', 60)
    expect(fetchMock).toHaveBeenCalledWith(new URL(signedUrl), { cache: 'no-store', redirect: 'error' })
    expect(preview.contentType).toBe('text/plain')
    expect(preview.fileSize).toBe(20)
    expect(preview.originalFilename).toBe('D01-note.txt')
    await expect(new Response(preview.body).text()).resolves.toBe('LiquidHR D01 preview')
  })

  it('does not sign or fetch an out-of-scope employee document', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://storage.example')
    const createSignedUrl = vi.fn()
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null })
    createClient.mockResolvedValue({ from: vi.fn(), rpc, storage: { from: vi.fn(() => ({ createSignedUrl })) } } as unknown as SupabaseServerClient)
    requirePermission.mockResolvedValue({})
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(createDocumentPreview(employeeId, documentId)).rejects.toMatchObject({ status: 403 })
    expect(createSignedUrl).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects a signed URL outside the configured Supabase origin', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://storage.example')
    const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: 'https://unexpected.example/object?token=test-only' }, error: null })
    const query = new DocumentQuery([storedTextDocument])
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    createClient.mockResolvedValue({ from: vi.fn(() => query), rpc, storage: { from: vi.fn(() => ({ createSignedUrl })) } } as unknown as SupabaseServerClient)
    requirePermission.mockResolvedValue({})
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(createDocumentPreview(employeeId, documentId)).rejects.toMatchObject({
      code: 'DOCUMENT_PREVIEW_FAILED',
      status: 502,
    } satisfies Partial<DocumentServiceError>)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects active HTML even when the storage response succeeds', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://storage.example')
    const signedUrl = 'https://storage.example/storage/v1/object/sign/employee-documents/d01/unsafe.html?token=test-only'
    const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl }, error: null })
    const query = new DocumentQuery([{ ...storedTextDocument, storage_key: 'd01/unsafe.html', content_type: 'text/html' }])
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    createClient.mockResolvedValue({ from: vi.fn(() => query), rpc, storage: { from: vi.fn(() => ({ createSignedUrl })) } } as unknown as SupabaseServerClient)
    requirePermission.mockResolvedValue({})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<script>unsafe</script>', { headers: { 'content-type': 'text/html' } })))

    await expect(createDocumentPreview(employeeId, documentId)).rejects.toMatchObject({
      code: 'DOCUMENT_PREVIEW_UNSUPPORTED',
      status: 415,
    })
  })
})

describe('employee document attachment download', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('streams a private file only after actor and employee scope checks', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://storage.example')
    const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: 'https://storage.example/storage/v1/object/sign/employee-documents/d01/note.txt?token=test-only' }, error: null })
    const query = new DocumentQuery([storedTextDocument])
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    createClient.mockResolvedValue({ from: vi.fn(() => query), rpc, storage: { from: vi.fn(() => ({ createSignedUrl })) } } as unknown as SupabaseServerClient)
    requirePermission.mockResolvedValue({})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('LiquidHR D01 preview', { headers: { 'content-type': 'text/plain', 'content-length': '20' } })))

    const file = await createDocumentDownload(employeeId, documentId)

    expect(requirePermission).toHaveBeenCalledWith('document:read', employeeId)
    expect(rpc).toHaveBeenCalledWith('can_access_employee_dossier', { requested_employee_id: employeeId, requested_permission: 'document:read' })
    expect(query.selectedColumns).toBe('storage_key, original_filename, content_type, file_size')
    expect(file).toMatchObject({ contentType: 'text/plain', fileSize: 20, originalFilename: 'D01-note.txt' })
    await expect(new Response(file.body).text()).resolves.toBe('LiquidHR D01 preview')
  })

  it('rejects a storage response whose advertised size differs from canonical metadata', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://storage.example')
    const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: 'https://storage.example/storage/v1/object/sign/employee-documents/d01/note.txt?token=test-only' }, error: null })
    const query = new DocumentQuery([storedTextDocument])
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    createClient.mockResolvedValue({ from: vi.fn(() => query), rpc, storage: { from: vi.fn(() => ({ createSignedUrl })) } } as unknown as SupabaseServerClient)
    requirePermission.mockResolvedValue({})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('short', { headers: { 'content-type': 'text/plain', 'content-length': '5' } })))

    await expect(createDocumentDownload(employeeId, documentId)).rejects.toMatchObject({ code: 'DOCUMENT_DOWNLOAD_FAILED', status: 502 })
  })
})
