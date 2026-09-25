import type { ChangeEvent, Dispatch, SetStateAction } from 'react'
import { describe, expect, it } from 'vitest'
import { applyDocumentCategorySalaryPermissionChange, type DocumentCategoryDraft } from './catalog-managers'

describe('document category salary permission input', () => {
  it('captures checkbox state before the deferred React state updater runs', () => {
    let input: HTMLInputElement | null = { checked: true } as HTMLInputElement
    const event = {
      get currentTarget() {
        return input as HTMLInputElement
      },
    } as ChangeEvent<HTMLInputElement>
    let updater: SetStateAction<DocumentCategoryDraft> | undefined
    const setDraft: Dispatch<SetStateAction<DocumentCategoryDraft>> = (next) => {
      updater = next
    }

    applyDocumentCategorySalaryPermissionChange(event, setDraft)
    input = null

    expect(typeof updater).toBe('function')
    if (typeof updater !== 'function') throw new Error('Expected a deferred state updater.')
    expect(updater({ code: '', name: '', description: '', requiresSalaryPermission: false }).requiresSalaryPermission).toBe(true)
  })
})
