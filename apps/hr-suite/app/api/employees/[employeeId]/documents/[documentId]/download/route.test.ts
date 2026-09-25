import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createDocumentDownload, permissionErrorResponse } = vi.hoisted(() => ({
  createDocumentDownload: vi.fn(),
  permissionErrorResponse: vi.fn(() => null),
}))

vi.mock('@/lib/documents/document-service', () => ({
  createDocumentDownload,
  DocumentServiceError: class DocumentServiceError extends Error {
    constructor(readonly code: string, readonly status: number) { super(code) }
  },
}))
vi.mock('@/lib/auth/permissions', () => ({ permissionErrorResponse }))

import { GET } from './route'
import { DocumentServiceError } from '@/lib/documents/document-service'

const params = {
  employeeId: '11111111-1111-4111-8111-111111111111',
  documentId: '22222222-2222-4222-8222-222222222222',
}

describe('GET employee document download', () => {
  beforeEach(() => {
    createDocumentDownload.mockReset()
    permissionErrorResponse.mockReset()
    permissionErrorResponse.mockReturnValue(null)
  })

  it('streams an authorized file as a private attachment and preserves a Unicode filename', async () => {
    createDocumentDownload.mockResolvedValue({
      body: new Blob(['D01 document']).stream(),
      contentType: 'text/plain',
      fileSize: 12,
      originalFilename: 'D01-café-测试.txt',
    })

    const response = await GET(new Request('http://localhost/download'), { params: Promise.resolve(params) })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/plain')
    expect(response.headers.get('content-length')).toBe('12')
    expect(response.headers.get('content-disposition')).toBe("attachment; filename=\"D01-caf---.txt\"; filename*=UTF-8''D01-caf%C3%A9-%E6%B5%8B%E8%AF%95.txt")
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    await expect(response.text()).resolves.toBe('D01 document')
    expect(createDocumentDownload).toHaveBeenCalledWith(params.employeeId, params.documentId)
  })

  it('maps authorization and safe service errors without redirecting to storage', async () => {
    createDocumentDownload.mockRejectedValue(new DocumentServiceError('DOCUMENT_NOT_FOUND', 404))

    const response = await GET(new Request('http://localhost/download'), { params: Promise.resolve(params) })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ code: 'DOCUMENT_NOT_FOUND' })
  })
})
