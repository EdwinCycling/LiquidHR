import { redirect } from 'next/navigation'
import { ActualWorkSettings } from '@/components/actual-work/actual-work-settings'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { listActualWorkPeriods, listActualWorkTypes } from '@/lib/actual-work/actual-work-service'
import { getTranslator } from '@/lib/i18n/server'

export default async function ActualWorkSettingsPage() {
  try {
    await requirePermission('leave:write')
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }
  const [types, periods, t] = await Promise.all([listActualWorkTypes(true), listActualWorkPeriods(), getTranslator('settings')])
  const label = (key: string) => t('actualWork.' + key)
  return <ActualWorkSettings initialPeriods={periods} initialTypes={types} labels={{
    title: label('title'),
    description: label('description'),
    back: label('back'),
    list: label('list'),
    create: label('create'),
    edit: label('edit'),
    newType: label('newType'),
    noSelection: label('noSelection'),
    code: label('code'),
    name: label('name'),
    family: label('family'),
    validFrom: label('validFrom'),
    validUntil: label('validUntil'),
    granularity: label('granularity'),
    commentRequired: label('commentRequired'),
    futureAllowed: label('futureAllowed'),
    teamOverview: label('teamOverview'),
    calendar: label('calendar'),
    approval: label('approval'),
    displayOrder: label('displayOrder'),
    limits: label('limits'),
    limitDay: label('limitDay'),
    limitWeek: label('limitWeek'),
    limitMonth: label('limitMonth'),
    maxHours: label('maxHours'),
    save: label('save'),
    saving: label('saving'),
    saved: label('saved'),
    failed: label('failed'),
    empty: label('empty'),
    identityHelp: label('identityHelp'),
    periods: label('periods'),
    periodStatus: label('periodStatus'),
    open: label('open'),
    closed: label('closed'),
    close: label('close'),
    closeConfirm: label('closeConfirm'),
    closedMessage: label('closedMessage'),
    familyWork: label('familyWork'),
    familyAdditional: label('familyAdditional'),
    familyOvertime: label('familyOvertime'),
    familyTransparent: label('familyTransparent'),
    day: label('day'),
    period: label('period'),
    both: label('both'),
    selectFamily: label('selectFamily'),
  }} />
}
