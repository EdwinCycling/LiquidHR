import { expect, it } from 'vitest'
import { compileProcessDefinition } from '@/lib/process-automation/definition-compiler'
import { wvpProcessDefinition } from './process-definition'

it('compileert met bestaande PMUX-compiler zonder medische tekstvelden', () => {
  const result = compileProcessDefinition(wvpProcessDefinition)
  expect(result.content.startStepKey).toBe('wvp-week-6')
  expect(result.content.forms.flatMap(f => f.sections.flatMap(s => s.fields)).every(f => f.type === 'BOOLEAN')).toBe(true)
})

it('routeert WVP-werk naar de canonieke PMUX-taakpermission, los van definitiepublicatie', () => {
  const participant = wvpProcessDefinition.participants.find(item => item.key === 'case-owner')
  expect(participant).toMatchObject({ permission: 'process-task:act', selector: { type: 'PERMISSION_WORK_QUEUE', permission: 'process-task:act', queueKey: 'wvp01' } })
})
