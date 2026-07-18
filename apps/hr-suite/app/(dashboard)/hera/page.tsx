import { HeRaChat, type HeRaLabels } from '@/components/hera/hera-chat'
import { getLocale } from '@/lib/i18n/server'
import { createTranslator } from '@/lib/i18n/translator'
import messagesEn from '@/messages/en/hera.json'
import messagesNl from '@/messages/nl/hera.json'

export function createHeRaLabels(locale: 'nl' | 'en'): HeRaLabels {
  const translate = createTranslator(locale === 'en' ? messagesEn : messagesNl)
  return {
    title: translate('title'), subtitle: translate('subtitle'), newConversation: translate('newConversation'),
    emptyTitle: translate('emptyTitle'), emptyDescription: translate('emptyDescription'), composerPlaceholder: translate('composerPlaceholder'),
    send: translate('send'), sending: translate('sending'), deleteConversation: translate('deleteConversation'), exportConversation: translate('exportConversation'),
    renameConversation: translate('renameConversation'), memoryConsent: translate('memoryConsent'), saveMemory: translate('saveMemory'),
    cancel: translate('cancel'), confirmDraft: translate('confirmDraft'), draftExpires: translate('draftExpires'), error: translate('error'), noConversations: translate('noConversations'),
    settings: translate('settings'), closeSettings: translate('closeSettings'), memoryTitle: translate('memoryTitle'), memoryDescription: translate('memoryDescription'),
    noMemory: translate('noMemory'), edit: translate('edit'), delete: translate('delete'), save: translate('save'), tone: translate('tone'), toneFriendly: translate('toneFriendly'),
    toneBusiness: translate('toneBusiness'), toneDirect: translate('toneDirect'), detailLevel: translate('detailLevel'), detailCompact: translate('detailCompact'),
    detailBalanced: translate('detailBalanced'), detailExtended: translate('detailExtended'), seniorityLevel: translate('seniorityLevel'), seniorityBasic: translate('seniorityBasic'),
    seniorityExperienced: translate('seniorityExperienced'), seniorityExpert: translate('seniorityExpert'), preferencesSave: translate('preferencesSave'),
    preferencesSaved: translate('preferencesSaved'), sourceLiquidHr: translate('sourceLiquidHr'), visibleRecords: translate('visibleRecords'), asOfDate: translate('asOfDate'),
    filters: translate('filters'), uncertainties: translate('uncertainties'), confirmAction: translate('confirmAction'), cancelAction: translate('cancelAction'),
    draftExpiresAt: translate('draftExpiresAt'), rememberProposal: translate('rememberProposal'), remember: translate('remember'),
    updateMemoryProposal: translate('updateMemoryProposal'), updateMemory: translate('updateMemory'),
    deleteMemoryProposal: translate('deleteMemoryProposal'), deleteMemory: translate('deleteMemory'),
    currentValue: translate('currentValue'), newValue: translate('newValue'),
  }
}

export default async function HeRaPage() {
  const locale = await getLocale()
  const labels = createHeRaLabels(locale)

  return <div className="p-4 sm:p-6 lg:p-8"><HeRaChat labels={labels} /></div>
}
