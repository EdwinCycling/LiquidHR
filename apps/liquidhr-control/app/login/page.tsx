import { ShieldCheck } from 'lucide-react'
import { LoginForm } from '@/components/auth/login-form'
import { getDictionary } from '@/lib/i18n/dictionary'

export default function LoginPage() {
  const dictionary = getDictionary()
  return (
    <main className="control-grid flex min-h-screen items-center justify-center p-5">
      <section className="panel-shadow enter grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-border bg-panel lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative overflow-hidden bg-primary p-8 text-primary-foreground sm:p-12">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full border border-accent/30" />
          <div className="absolute -right-5 -top-5 h-40 w-40 rounded-full bg-accent/10" />
          <div className="relative flex h-full min-h-80 flex-col justify-between">
            <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-primary"><ShieldCheck size={22} /></span><div><p className="font-bold">{dictionary.appName}</p><p className="text-xs text-primary-foreground/65">{dictionary.appTagline}</p></div></div>
            <div><p className="text-xs font-bold uppercase tracking-[0.22em] text-accent">{dictionary.login.eyebrow}</p><h1 className="mt-4 text-5xl font-bold tracking-[-0.055em]">{dictionary.login.title}</h1><p className="mt-5 max-w-md text-base leading-7 text-primary-foreground/72">{dictionary.login.subtitle}</p></div>
          </div>
        </div>
        <div className="p-8 sm:p-12"><p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">{dictionary.appName}</p><LoginForm /><p className="mt-7 border-t border-border pt-6 text-xs leading-5 text-muted-foreground">{dictionary.login.notice}</p></div>
      </section>
    </main>
  )
}
