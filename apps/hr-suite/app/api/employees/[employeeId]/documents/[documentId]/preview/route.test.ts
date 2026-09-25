import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createDocumentPreview, permissionErrorResponse } = vi.hoisted(() => ({
  createDocumentPreview: vi.fn(),
  permissionErrorResponse: vi.fn(() => null),
}))

vi.mock('@/lib/documents/document-service', () => ({
  createDocumentPreview,
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

describe('GET employee document preview', () => {
  beforeEach(() => {
    createDocumentPreview.mockReset()
    permissionErrorResponse.mockReset()
    permissionErrorResponse.mockReturnValue(null)
  })

  it('streams the preview with private inline response headers', async () => {
    createDocumentPreview.mockResolvedValue({ body: new Blob(['D01 preview']).stream(), contentType: 'text/plain', fileSize: 11, originalFilename: 'D01-preview.txt' })

    const response = await GET(new Request('http://localhost/preview'), { params: Promise.resolve(params) })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/plain')
    expect(response.headers.get('content-disposition')).toBe('inline')
    expect(response.headers.get('content-length')).toBe('11')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN')
    await expect(response.text()).resolves.toBe('D01 preview')
    expect(createDocumentPreview).toHaveBeenCalledWith(params.employeeId, params.documentId)
  })

  it('maps unsupported preview content to a safe error response', async () => {
    createDocumentPreview.mockRejectedValue(new DocumentServiceError('DOCUMENT_PREVIEW_UNSUPPORTED', 415))

    const response = await GET(new Request('http://localhost/preview'), { params: Promise.resolve(params) })

    expect(response.status).toBe(415)
    await expect(response.json()).resolves.toEqual({ code: 'DOCUMENT_PREVIEW_UNSUPPORTED' })
  })
})
