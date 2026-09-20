import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sql = readFileSync(resolve(__dirname, '20260920160000_focus_public_wrapper_security.sql'), 'utf8')

describe('Focus public wrapper security migration contract', () => {
  it('keeps authenticated access on the scoped public wrappers', () => {
    expect(sql).toContain('alter function public.register_absence_confirmation(uuid, uuid) security definer')
    expect(sql).toContain('alter function public.report_focus_employee_absence(uuid, uuid, uuid, uuid, date, date, text) security definer')
    expect(sql).toContain('alter function public.confirm_absence_confirmation(uuid) security definer')
    expect(sql).toContain('alter function public.request_absence_correction(uuid, text) security definer')
  })
})
