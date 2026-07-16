import { redirect } from 'next/navigation'
import { LogOut, ShieldAlert } from 'lucide-react'
import { getTranslator } from '@/lib/i18n/server'
import { createClient } from '@/lib/supabase/server'

export default async function NoAccessPage() {
  const [auth, common] = await Promise.all([
    getTranslator('auth'),
    getTranslator('common'),
  ])
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()

  if (!data?.claims?.sub) redirect('/login')

  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 py-10">
      <section className="liquid-panel-shadow w-full max-w-lg rounded-2xl border bg-surface p-7 text-center sm:p-10">
        <div className="mx-auto grid size-14 place-items-center rounded-xl bg-warning-surface text-warning">
          <ShieldAlert aria-hidden="true" size={27} />
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-accent-foreground">{common('appName')}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-foreground">{auth('noAccessTitle')}</h1>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-muted-foreground">{auth('noAccessBody')}</p>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{auth('noAccessHelp')}</p>
        <form action="/auth/signout" className="mt-8" method="post">
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border bg-surface-raised px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted" type="submit">
            <LogOut aria-hidden="true" size={17} />
            {auth('signOut')}
          </button>
        </form>
      </section>
    </main>
  )
}
