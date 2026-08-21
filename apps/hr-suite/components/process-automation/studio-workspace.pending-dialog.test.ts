import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./studio-workspace.tsx', import.meta.url), 'utf8')

describe('process automation pending action dialogs', () => {
  it('keeps publish and retire dialogs non-closable while their API action is pending', () => {
    expect(source.match(/closeLabel=\{(?:publishPending|retirePending) \? undefined : labels\.cancel\}/g)).toHaveLength(2)
    expect(source.match(/closeOnBackdropClick=\{!(?:publishPending|retirePending)\}/g)).toHaveLength(2)
    expect(source.match(/closeOnEscape=\{!(?:publishPending|retirePending)\}/g)).toHaveLength(2)
    expect(source).toContain("if (!publishPending) setShowPublish(open)")
    expect(source).toContain("if (!retirePending) setShowRetire(open)")
  })
})
