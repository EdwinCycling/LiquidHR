import { Check } from 'lucide-react'

interface AuthShellProps {
  brand: string
  visualTitle: string
  visualBody: string
  visualPoints: readonly string[]
  children: React.ReactNode
}

export function AuthShell({
  brand,
  visualTitle,
  visualBody,
  visualPoints,
  children,
}: AuthShellProps) {
  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[minmax(24rem,0.94fr)_minmax(32rem,1.06fr)]">
      <aside className="liquid-auth-visual relative hidden min-h-screen flex-col justify-between px-12 py-10 text-primary-foreground lg:flex xl:px-16 xl:py-14">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="grid size-10 place-items-center rounded-lg border border-primary-foreground/25 bg-primary-foreground/10 text-sm font-semibold tracking-tight">
            LH
          </span>
          <span className="text-base font-semibold tracking-tight">{brand}</span>
        </div>

        <div className="max-w-xl pb-8">
          <p className="max-w-lg text-5xl font-semibold leading-[1.04] tracking-[-0.045em] xl:text-6xl">
            {visualTitle}
          </p>
          <p className="mt-7 max-w-lg text-base leading-7 text-primary-foreground/72">
            {visualBody}
          </p>
          <ul className="mt-10 space-y-4">
            {visualPoints.map((point) => (
              <li className="flex items-start gap-3 text-sm text-primary-foreground/88" key={point}>
                <span aria-hidden="true" className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border border-primary-foreground/25 bg-primary-foreground/10">
                  <Check size={13} strokeWidth={2.5} />
                </span>
                <span className="leading-5">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs tracking-wide text-primary-foreground/54">{brand}</p>
      </aside>

      <section className="relative grid min-h-screen place-items-center overflow-hidden px-5 py-10 sm:px-8 lg:px-12">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent lg:hidden" />
        <div className="w-full max-w-[29rem]">{children}</div>
      </section>
    </main>
  )
}
