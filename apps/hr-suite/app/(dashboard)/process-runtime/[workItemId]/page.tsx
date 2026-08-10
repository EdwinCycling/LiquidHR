import { FormRuntimeRenderer } from '@/components/process-automation/form-runtime-renderer'
import { getProcessFormProjection } from '@/lib/process-automation/form-runtime-service'
import { getLocale, getTranslator } from '@/lib/i18n/server'

interface Params {
  params: Promise<{ workItemId: string }>
}

export default async function ProcessRuntimePage({ params }: Params) {
  const { workItemId } = await params
  const locale = await getLocale()
  const [projection, t] = await Promise.all([
    getProcessFormProjection(workItemId, locale),
    getTranslator('processAutomation', locale),
  ])
  return <FormRuntimeRenderer initialProjection={projection} locale={locale} labels={{
    currentValue: t('currentValue'),
    newValue: t('newValue'),
    saving: t('saving'),
    saved: t('saved'),
    saveError: t('saveError'),
    stale: t('stale'),
    save: t('save'),
    errorSummary: t('errorSummary'),
    required: t('required'),
    invalid: t('invalid'),
    readOnly: t('readOnly'),
    noValue: t('noValue'),
    booleanTrue: t('booleanTrue'),
    booleanFalse: t('booleanFalse'),
    referenceSearch: t('referenceSearch'),
    referenceLoading: t('referenceLoading'),
    referenceNoOptions: t('referenceNoOptions'),
    scrollHint: t('scrollHint'),
  }} />
}
