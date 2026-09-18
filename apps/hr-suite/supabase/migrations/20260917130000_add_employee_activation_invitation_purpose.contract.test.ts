import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const enumMigration = readFileSync(resolve(__dirname, '20260917130000_add_employee_activation_invitation_purpose.sql'), 'utf8')
const constraintMigration = readFileSync(resolve(__dirname, '20260917130100_expand_employee_invitation_purpose_constraint.sql'), 'utf8')

describe('employee activation invitation purpose contract', () => {
  it('adds one backwards-compatible enum value without changing existing purposes', () => {
    expect(enumMigration).toContain("add value if not exists 'EMPLOYEE_ACTIVATION'")
    expect(enumMigration).not.toContain('drop type')
    expect(enumMigration).not.toContain('PREBOARDING_EMPLOYEE')
  })

  it('requires employee-linked private email for both employee purposes', () => {
    expect(constraintMigration).toContain("purpose in ('PREBOARDING_EMPLOYEE', 'EMPLOYEE_ACTIVATION')")
    expect(constraintMigration).toContain("email_kind = 'PRIVATE'")
    expect(constraintMigration).toContain('employee_id is not null')
    expect(constraintMigration).toContain("purpose = 'BUSINESS_USER'")
  })
})
