import { expect, it } from 'vitest'
import { compileProcessDefinition } from '@/lib/process-automation/definition-compiler'
import { wvpProcessDefinition } from './process-definition'

it('compileert met bestaande PMUX-compiler zonder medische tekstvelden', () => {
  const result = compileProcessDefinition(wvpProcessDefinition)
  expect(result.content.startStepKey).toBe('wvp-week-6')
  expect(result.content.forms.flatMap(f => f.sections.flatMap(s => s.fields)).every(f => f.type === 'BOOLEAN')).toBe(true)
})
