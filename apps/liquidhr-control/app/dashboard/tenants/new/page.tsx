import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { OnboardingForm } from '@/components/control/onboarding-form'
import { getControlSnapshot } from '@/lib/control/service'
import { getDictionary } from '@/lib/i18n/dictionary'
import { PageShell } from '@/components/ui/page-shell'

export default async function NewTenantPage() {
  const snapshot = await getControlSnapshot()
  if (snapshot.operator.role === 'AUDITOR') return null
  const dictionary = getDictionary()
  return <PageShell className="enter" width="reading"><Link className="inline-flex items-center gap-2 rounded-[var(--radius-control)] text-sm font-medium text-muted-foreground focus-visible:outline-2 focus-visible:outline-focus" href="/dashboard"><ArrowLeft size={16} />{dictionary.tenant.back}</Link><header className="mt-8"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-success">{dictionary.onboarding.eyebrow}</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{dictionary.onboarding.title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{dictionary.onboarding.subtitle}</p></header><OnboardingForm /></PageShell>
}
