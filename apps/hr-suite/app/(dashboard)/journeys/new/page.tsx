import Link from 'next/link'
import { ActivationWizard } from '@/components/journeys/activation-wizard'
import { getLocale } from '@/lib/i18n/server'
import { journeyRuntime } from '@/lib/journeys'
import { getJourneyLabels } from '@/lib/journeys/labels'

export default async function NewJourneyPage() {
  const [options, labels, locale] = await Promise.all([journeyRuntime.startOptions(), getJourneyLabels(), getLocale()])
  return <div className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-10"><Link className="text-sm font-semibold text-primary" href="/journeys">← {labels.back}</Link><header className="mb-8 mt-5"><p className="eyebrow">{labels.eyebrow}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{labels.newTitle}</h1><p className="mt-3 text-muted-foreground">{labels.newSubtitle}</p></header><ActivationWizard labels={labels} locale={locale} options={options} /></div>
}
