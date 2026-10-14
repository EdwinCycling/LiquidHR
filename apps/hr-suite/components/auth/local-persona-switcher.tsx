import { buttonClasses } from '@/components/ui/button'
import type { TestRoleSwitchTarget } from '@/lib/auth/test-role-switch'

export type LocalPersonaOption = TestRoleSwitchTarget & {
  label: string
  availabilityLabel?: string
}

export function LocalPersonaSwitcher({
  isOwner,
  options,
  labels,
}: {
  isOwner: boolean
  options: readonly LocalPersonaOption[]
  labels: {
    choosePersona: string
    switchAccount: string
    returnToOwner: string
    unavailable: string
    returnDescription: string
  }
}) {
  return <section className="space-y-4">
    {isOwner ? <form action="/api/auth/test-role-switch" className="space-y-3 rounded-[var(--radius-surface)] border border-border-subtle p-4 sm:p-5" method="post">
      <label className="block space-y-2 text-sm font-medium" htmlFor="local-persona-target">
        <span>{labels.choosePersona}</span>
        <select
          className="min-h-11 w-full rounded-[var(--radius-control)] border border-input bg-background px-3 py-2 text-base text-foreground focus-visible:outline-2 focus-visible:outline-focus"
          defaultValue=""
          id="local-persona-target"
          name="target"
          required
        >
          <option disabled value="">{labels.choosePersona}</option>
          {options.map((option) => <option disabled={!option.available} key={option.key} value={option.key}>
            {option.available ? option.label : `${option.label} — ${option.availabilityLabel ?? labels.unavailable}`}
          </option>)}
        </select>
      </label>
      <input name="next" type="hidden" value="/dashboard/start" />
      <button className={buttonClasses({ size: 'md', variant: 'primary' })} type="submit">{labels.switchAccount}</button>
    </form> : <form action="/api/auth/test-role-switch" className="rounded-[var(--radius-surface)] border border-border-subtle p-4 sm:p-5" method="post">
      <input name="target" type="hidden" value="edwin" />
      <input name="next" type="hidden" value="/dashboard/start" />
      <p className="text-sm text-muted-foreground">{labels.returnDescription}</p>
      <button className={`${buttonClasses({ size: 'md', variant: 'primary' })} mt-3`} type="submit">{labels.returnToOwner}</button>
    </form>}
  </section>
}
