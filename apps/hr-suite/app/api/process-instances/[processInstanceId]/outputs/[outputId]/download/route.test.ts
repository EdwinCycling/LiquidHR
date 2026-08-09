import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, createProcessOutputDocumentDownload, permissionErrorResponse } = vi.hoisted(() => ({
  createClient: vi.fn(),
  createProcessOutputDocumentDownload: vi.fn(),
  permissionErrorResponse: vi.fn(() => null),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/documents/document-service', () => ({
  createProcessOutputDocumentDownload,
  DocumentServiceError: class DocumentServiceError extends Error {
    readonly code = 'DOCUMENT_NOT_FOUND'
    readonly status = 404
  },
}))
vi.mock('@/lib/auth/permissions', () => ({ permissionErrorResponse }))

import { GET } from './route'

const params = {
  processInstanceId: '00000000-0000-4000-8000-000000000001',
  outputId: '00000000-0000-4000-8000-000000000002',
}

describe('GET process output download', () => {
  beforeEach(() => {
    createClient.mockReset()
    createProcessOutputDocumentDownload.mockReset()
    permissionErrorResponse.mockReset()
    permissionErrorResponse.mockReturnValue(null)
  })

  it('weigert een output zonder toegestane process- of documentcontext', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'FORBIDDEN' } })
    createClient.mockResolvedValue({ rpc })

    const response = await GET(new Request('http://localhost/download'), { params: Promise.resolve(params) })

    expect(response.status).toBe(403)
    expect(createProcessOutputDocumentDownload).not.toHaveBeenCalled()
  })

  it('geeft alleen na contextcontrole een bestaande dossierdownload door', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        subjectEmployeeId: '00000000-0000-4000-8000-000000000003',
        documentId: '00000000-0000-4000-8000-000000000004',
      },
      error: null,
    })
    createClient.mockResolvedValue({ rpc })
    createProcessOutputDocumentDownload.mockResolvedValue('https://example.test/signed.pdf')

    const response = await GET(new Request('http://localhost/download'), { params: Promise.resolve(params) })

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://example.test/signed.pdf')
    expect(createProcessOutputDocumentDownload).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000003',
      '00000000-0000-4000-8000-000000000004',
    )
  })
})
