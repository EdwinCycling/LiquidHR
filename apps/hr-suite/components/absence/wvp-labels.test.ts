import { expect, it } from 'vitest'
import { wvpLabelKeys } from './wvp-labels'

it('exports shared WVP translation keys as a plain serializable array', () => {
  expect(Array.isArray(wvpLabelKeys)).toBe(true)
  expect(wvpLabelKeys).toContain('title')
  expect(wvpLabelKeys).toContain('ACKNOWLEDGED')
})