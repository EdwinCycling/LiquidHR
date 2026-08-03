import Link from 'next/link'
import { Building2, Gauge, LogOut, Plus, ShieldCheck } from 'lucide-react'
import { getDictionary } from '@/lib/i18n/dictionary'

export function Sidebar({ displayName, role }: { displayName: string; role: 'OWNER' | 'OPERATOR' | 'AUDITOR' }) {
  const dictionary = getDictionary()
  return <aside className="flex min-h-20 items-center justify-between gap-5 bg-primary px-5 py-4 text-primary-foreground lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:flex-col lg:items-stretch lg:px-5 lg:py-7">
    <div><Link className="flex items-center gap-3" href="/dashboard"><span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-primary"><ShieldCheck size={20} /></span><span><strong className="block text-sm">{dictionary.appName}</strong><small className="text-primary-foreground/55">{dictionary.appTagline}</small></span></Link>
      <nav className="mt-10 hidden space-y-2 lg:block"><Link className="flex items-center gap-3 rounded-xl bg-primary-foreground/10 px-4 py-3 text-sm font-semibold" href="/dashboard"><Gauge size={18} />{dictionary.navigation.overview}</Link><Link className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-primary-foreground/70 hover:bg-primary-foreground/8" href="/dashboard#klanten"><Building2 size={18} />{dictionary.navigation.tenants}</Link>{role !== 'AUDITOR' ? <Link className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-primary-foreground/70 hover:bg-primary-foreground/8" href="/dashboard/tenants/new"><Plus size={18} />{dictionary.navigation.newTenant}</Link> : null}</nav>
    </div>
    <div className="flex items-center gap-3 lg:w-full lg:border-t lg:border-primary-foreground/15 lg:pt-5"><span className="grid h-9 w-9 place-items-center rounded-full bg-accent font-bold text-primary">{displayName.slice(0, 1).toUpperCase()}</span><span className="hidden min-w-0 flex-1 lg:block"><strong className="block truncate text-sm">{displayName}</strong><small className="text-primary-foreground/55">{dictionary.roles[role]}</small></span><Link aria-label={dictionary.navigation.signOut} className="rounded-lg p-2 text-primary-foreground/60 hover:bg-primary-foreground/10 hover:text-primary-foreground" href="/auth/signout"><LogOut size={18} /></Link></div>
  </aside>
}
