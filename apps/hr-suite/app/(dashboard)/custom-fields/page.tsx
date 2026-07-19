import { CustomFieldManager } from '@/components/custom-fields/custom-field-manager'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { listCustomFieldDefinitions } from '@/lib/custom-fields/service'
import { getTranslator } from '@/lib/i18n/server'

export default async function CustomFieldsPage() {
  const [definitions, t, settings] = await Promise.all([listCustomFieldDefinitions(), getTranslator('customFields'), getTranslator('settings')])
  return <section className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10"><AdminSettingsPageHeader backLabel={settings('admin.backToOverview')} eyebrow={t('eyebrow')} subtitle={t('subtitle')} title={t('title')} /><CustomFieldManager definitions={definitions} labels={{ newField: t('newField'), technicalKey: t('technicalKey'), labelNl: t('labelNl'), labelEn: t('labelEn'), fieldType: t('fieldType'), required: t('required'), hrAccess: t('hrAccess'), managerAccess: t('managerAccess'), selfAccess: t('selfAccess'), options: t('options'), chartFilter: t('chartFilter'), chartFilterHelp: t('chartFilterHelp'), create: t('create'), creating: t('creating'), empty: t('empty'), created: t('created'), failed: t('failed'), active: t('active'), inactive: t('inactive'), types: { TEXT: t('types.TEXT'), TEXTAREA: t('types.TEXTAREA'), NUMBER: t('types.NUMBER'), DATE: t('types.DATE'), BOOLEAN: t('types.BOOLEAN'), SELECT: t('types.SELECT'), MULTI_SELECT: t('types.MULTI_SELECT'), AUTO_INCREMENT: t('types.AUTO_INCREMENT') }, access: { HIDDEN: t('access.HIDDEN'), READ: t('access.READ'), WRITE: t('access.WRITE') } }} /></section>
}
