'use client'

import type { TestRoleSwitchTargetKey } from '@/lib/auth/test-role-switch'

export interface TestRoleSwitchOption {
  key: TestRoleSwitchTargetKey
  email: string
  label: string
}

interface TestRoleSwitcherProps {
  currentEmail: string
  labels: {
    title: string
    hint: string
  }
  options: TestRoleSwitchOption[]
}

export function TestRoleSwitcher({ currentEmail, labels, options }: TestRoleSwitcherProps) {
  const normalizedCurrentEmail = currentEmail.trim().toLowerCase()
  const currentOption = options.find((option) => option.email === normalizedCurrentEmail)

  return (
    <div className="mb-4 rounded-xl border border-sidebar-border bg-sidebar-accent/45 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-sidebar-foreground">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-sidebar-foreground/70" />
        {labels.title}
      </div>
      <form action="/api/auth/test-role-switch" className="mt-2" method="post">
        <label className="sr-only" htmlFor="test-role-switch-target">{labels.title}</label>
        <select
          className="h-10 w-full rounded-lg border border-sidebar-border bg-sidebar px-2.5 text-sm text-sidebar-foreground outline-none focus:border-sidebar-foreground"
          defaultValue={currentOption?.key}
          id="test-role-switch-target"
          name="target"
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
        >
          {options.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
        </select>
      </form>
      <p className="mt-2 text-[0.7rem] leading-4 text-sidebar-muted">{labels.hint}</p>
    </div>
  )
}
