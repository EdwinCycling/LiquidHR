import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { OnboardingForm } from '@/components/control/onboarding-form'
import { getControlSnapshot } from '@/lib/control/service'
import { getDictionary } from '@/lib/i18n/dictionary'

export default async function NewTenantPage() {
  const snapshot = await getControlSnapshot()
  if (snapshot.operator.role === 'AUDITOR') return null
  const dictionary = getDictionary()
  return <div className="enter mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:py-10"><Link className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground" href="/dashboard"><ArrowLeft size={16} />{dictionary.tenant.back}</Link><header className="mt-8"><p className="text-xs font-bold uppercase tracking-[0.2em] text-success">{dictionary.onboarding.eyebrow}</p><h1 className="mt-3 text-4xl font-bold tracking-[-0.055em] sm:text-5xl">{dictionary.onboarding.title}</h1><p className="mt-3 max-w-2xl leading-7 text-muted-foreground">{dictionary.onboarding.subtitle}</p></header><OnboardingForm /></div>
}
