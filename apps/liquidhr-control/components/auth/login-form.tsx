'use client'

import { useActionState } from 'react'
import { Globe2, KeyRound, LoaderCircle, Mail } from 'lucide-react'
import { signIn, signInWithGoogle, type LoginState } from '@/lib/auth/actions'
import { getDictionary } from '@/lib/i18n/dictionary'

const initialState: LoginState = { code: 'idle' }

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, initialState)
  const labels = getDictionary().login
  return (
    <>
      <form action={action} className="mt-8 space-y-5">
      <label className="block text-sm font-semibold">
        {labels.email}
        <span className="relative mt-2 block">
          <Mail aria-hidden className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <input autoComplete="email" className="h-12 w-full rounded-xl border border-border bg-panel-soft pl-11 pr-4 outline-none focus:border-primary" name="email" required type="email" />
        </span>
      </label>
      <label className="block text-sm font-semibold">
        {labels.password}
        <span className="relative mt-2 block">
          <KeyRound aria-hidden className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <input autoComplete="current-password" className="h-12 w-full rounded-xl border border-border bg-panel-soft pl-11 pr-4 outline-none focus:border-primary" maxLength={72} name="password" required type="password" />
        </span>
      </label>
      {state.code === 'invalid' ? <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">{labels.error}</p> : null}
      <button className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 font-bold text-primary-foreground disabled:opacity-60" disabled={pending} type="submit">
        {pending ? <LoaderCircle aria-hidden className="animate-spin" size={18} /> : null}
        {pending ? labels.submitting : labels.submit}
      </button>
      </form>
      <div className="my-6 flex items-center gap-3" role="separator"><span className="h-px flex-1 bg-border" /><span className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{labels.or}</span><span className="h-px flex-1 bg-border" /></div>
      <form action={signInWithGoogle}><input name="next" type="hidden" value="/dashboard" /><button className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-border bg-panel px-4 font-bold text-foreground transition-colors hover:bg-panel-soft" type="submit"><Globe2 aria-hidden size={18} />{labels.google}</button></form>
    </>
  )
}
