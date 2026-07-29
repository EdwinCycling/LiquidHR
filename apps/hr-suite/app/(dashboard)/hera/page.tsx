import { HeRaChat } from '@/components/hera/hera-chat'
import { getLocale } from '@/lib/i18n/server'
import { createHeRaLabels } from '@/lib/hera/labels'

export default async function HeRaPage() {
  const locale = await getLocale()
  const labels = createHeRaLabels(locale)

  return <div className="p-4 sm:p-6 lg:p-8"><HeRaChat labels={labels} /></div>
}
