// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProvenanceCopyButton } from './provenance-copy-button'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('Payroll provenance copy control', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('copies the complete original value and announces success', async () => {
    const value = `docs/payroll/${'long-path-segment/'.repeat(20)}source.pdf#${'a'.repeat(64)}`
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })

    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    act(() => root.render(<ProvenanceCopyButton
      copiedLabel="Gekopieerd"
      copyLabel="Kopieer volledige waarde"
      failedLabel="Kopiëren mislukt"
      value={value}
    />))

    try {
      const button = host.querySelector('button')
      expect(button?.getAttribute('aria-label')).toBe('Kopieer volledige waarde')
      await act(async () => {
        button?.click()
        await Promise.resolve()
      })

      expect(writeText).toHaveBeenCalledOnce()
      expect(writeText).toHaveBeenCalledWith(value)
      expect(host.querySelector('[role="status"]')?.textContent).toBe('Gekopieerd')
    } finally {
      act(() => root.unmount())
      host.remove()
    }
  })

  it('announces when the clipboard write fails', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('blocked')) },
    })

    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    act(() => root.render(<ProvenanceCopyButton
      copiedLabel="Copied"
      copyLabel="Copy full value"
      failedLabel="Copy failed"
      value="sha256-value"
    />))

    try {
      await act(async () => {
        host.querySelector('button')?.click()
        await Promise.resolve()
      })
      expect(host.querySelector('[role="status"]')?.textContent).toBe('Copy failed')
    } finally {
      act(() => root.unmount())
      host.remove()
    }
  })
})
