import { buttonClasses } from '@/components/ui/button'
import type { TestRoleSwitchTargetKey } from '@/lib/auth/test-role-switch'

export type LocalPersonaOption = {
  key: TestRoleSwitchTargetKey
  email: string
  available: boolean
  label: string
  availabilityLabel?: string
  canSwitch?: boolean
  canProvision?: boolean
}

export function LocalPersonaSwitcher({
  isOwner,
  returnTargetKey,
  options,
  labels,
}: {
  isOwner: boolean
  returnTargetKey: string
  options: readonly LocalPersonaOption[]
  labels: {
    choosePersona: string
    switchAccount: string
    returnToOwner: string
    unavailable: string
    returnDescription: string
    provisionTitle: string
    provisionDescription: string
    provisionAccount: string
  }
}) {
  const provisionableOptions = options.filter((option) => option.canProvision)

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
          {options.map((option) => {
            const canSwitch = option.canSwitch ?? option.available
            return <option disabled={!canSwitch} key={option.key} value={option.key}>
              {option.availabilityLabel ? `${option.label} — ${option.availabilityLabel}` : option.label}
            </option>
          })}
        </select>
      </label>
      <input name="next" type="hidden" value="/dashboard/start" />
      <button className={buttonClasses({ size: 'md', variant: 'primary' })} type="submit">{labels.switchAccount}</button>
    </form> : <form action="/api/auth/test-role-switch" className="rounded-[var(--radius-surface)] border border-border-subtle p-4 sm:p-5" method="post">
      <input name="target" type="hidden" value={returnTargetKey} />
      <input name="next" type="hidden" value="/dashboard/start" />
      <p className="text-sm text-muted-foreground">{labels.returnDescription}</p>
      <button className={`${buttonClasses({ size: 'md', variant: 'primary' })} mt-3`} type="submit">{labels.returnToOwner}</button>
    </form>}
    {isOwner && provisionableOptions.length > 0 ? <section aria-labelledby="local-persona-provision-title" className="space-y-3 rounded-[var(--radius-surface)] border border-border-subtle p-4 sm:p-5">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold" id="local-persona-provision-title">{labels.provisionTitle}</h2>
        <p className="text-sm text-muted-foreground">{labels.provisionDescription}</p>
      </div>
      <ul className="divide-y divide-subtle border-y border-subtle">
        {provisionableOptions.map((option) => <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between" key={option.key}>
          <div className="min-w-0">
            <p className="font-medium">{option.label}</p>
            <p className="text-sm text-muted-foreground">{option.availabilityLabel ?? labels.unavailable}</p>
          </div>
          <form action="/api/local/personas/provision" method="post">
            <input name="target" type="hidden" value={option.key} />
            <button className={buttonClasses({ size: 'md', variant: 'secondary' })} type="submit">{labels.provisionAccount}</button>
          </form>
        </li>)}
      </ul>
    </section> : null}
  </section>
}
