import { describe, expect, it } from 'vitest'
import { BoundedRequestBodyError, PUBLIC_RECRUITMENT_REQUEST_MAX_BYTES, readBoundedRequest } from './bounded-request-body'

function bytes(size: number): Uint8Array {
  return new Uint8Array(size)
}

describe('bounded request body', () => {
  it('accepts a body exactly at the public limit', async () => {
    const bounded = await readBoundedRequest(new Request('https://example.test', {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream', 'content-length': String(PUBLIC_RECRUITMENT_REQUEST_MAX_BYTES) },
      body: bytes(PUBLIC_RECRUITMENT_REQUEST_MAX_BYTES) as unknown as BodyInit,
    }))
    expect((await bounded.arrayBuffer()).byteLength).toBe(PUBLIC_RECRUITMENT_REQUEST_MAX_BYTES)
  })

  it('rejects a streamed body that exceeds the limit', async () => {
    await expect(readBoundedRequest(new Request('https://example.test', {
      method: 'POST',
      body: bytes(4) as unknown as BodyInit,
    }), 3)).rejects.toBeInstanceOf(BoundedRequestBodyError)
  })

  it('rejects a declared oversized body before reading the stream', async () => {
    let readerCalls = 0
    const body = { getReader: () => { readerCalls += 1; throw new Error('body must not be read') } } as unknown as ReadableStream<Uint8Array>
    const oversizedRequest = { headers: new Headers({ 'content-length': '5' }), body } as unknown as Request
    await expect(readBoundedRequest(oversizedRequest, 4)).rejects.toBeInstanceOf(BoundedRequestBodyError)
    expect(readerCalls).toBe(0)
  })

  it('fails closed when the declared length is malformed or forged small', async () => {
    for (const declaredLength of ['not-a-number', '1']) {
      await expect(readBoundedRequest(new Request('https://example.test', {
        method: 'POST',
        headers: { 'content-length': declaredLength },
        body: bytes(5) as unknown as BodyInit,
      }), 4)).rejects.toBeInstanceOf(BoundedRequestBodyError)
    }
  })

  it('reconstructs a bounded JSON request without hop-by-hop length headers', async () => {
    const bounded = await readBoundedRequest(new Request('https://example.test', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': '999' },
      body: JSON.stringify({ ok: true }),
    }), 1000)
    expect(bounded.headers.get('content-type')).toContain('application/json')
    expect(bounded.headers.get('content-length')).toBeNull()
    await expect(bounded.json()).resolves.toEqual({ ok: true })
  })

  it('reconstructs bounded multipart form data', async () => {
    const form = new FormData()
    form.set('slug', 'open-role')
    form.set('firstName', 'Ada')
    const bounded = await readBoundedRequest(new Request('https://example.test', { method: 'POST', body: form }))
    const parsed = await bounded.formData()
    expect(parsed.get('slug')).toBe('open-role')
    expect(parsed.get('firstName')).toBe('Ada')
  })
})
