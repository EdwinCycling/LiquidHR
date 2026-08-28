import { PageHeader } from '@/components/patterns/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { ProductUpdateManager } from '@/components/product-updates/product-update-manager'
import { getTranslator } from '@/lib/i18n/server'
import { listManagedProductUpdates } from '@/lib/product-updates/service'

export default async function ProductUpdatesSettingsPage() {
  const [t, management] = await Promise.all([getTranslator('productUpdates'), listManagedProductUpdates()])
  return <PageShell className="py-8 sm:py-10" width="standard"><PageHeader description={t('adminSubtitle')} title={t('adminTitle')} /><ProductUpdateManager initial={management.updates} canManageGlobal={management.canManageGlobal} canManageTenant={management.canManageTenant} labels={{ title: t('adminTitle'), subtitle: t('adminSubtitle'), add: t('add'), edit: t('edit'), delete: t('delete'), deleteConfirm: t('deleteConfirm'), titleLabel: t('titleLabel'), summaryLabel: t('summaryLabel'), contentLabel: t('contentLabel'), kindLabel: t('kindLabel'), channelsLabel: t('channelsLabel'), audienceLabel: t('audienceLabel'), activeLabel: t('activeLabel'), hrAdmin: t('hrAdmin'), manager: t('manager'), employee: t('employee'), newFeature: t('newFeature'), improvement: t('improvement'), giftWindow: t('giftWindow'), loginPopup: t('loginPopup'), topBanner: t('topBanner'), dateFrom: t('dateFrom'), dateUntil: t('dateUntil'), save: t('save'), cancel: t('cancel'), saving: t('saving'), failed: t('failed'), invalid: t('invalid'), noResults: t('noResults'), scopeLabel: t('scopeLabel'), globalScope: t('globalScope'), tenantScope: t('tenantScope'), readOnly: t('readOnly'), ownerNotice: t('ownerNotice'), created: t('created'), deleted: t('deleted'), discardTitle: t('discardTitle'), discardDescription: t('discardDescription'), discardConfirm: t('discardConfirm'), keepEditing: t('keepEditing') }} /></PageShell>
}
