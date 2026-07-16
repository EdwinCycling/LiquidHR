import { HeRaChat, type HeRaLabels } from '@/components/hera/hera-chat'
import { getLocale } from '@/lib/i18n/server'
import { createTranslator } from '@/lib/i18n/translator'
import messagesEn from '@/messages/en/hera.json'
import messagesNl from '@/messages/nl/hera.json'

export default async function HeRaPage() {
  const locale = await getLocale()
  const translate = createTranslator(locale === 'en' ? messagesEn : messagesNl)
  const labels: HeRaLabels = {
    title: translate('title'), subtitle: translate('subtitle'), newConversation: translate('newConversation'),
    emptyTitle: translate('emptyTitle'), emptyDescription: translate('emptyDescription'), composerPlaceholder: translate('composerPlaceholder'),
    send: translate('send'), sending: translate('sending'), deleteConversation: translate('deleteConversation'), exportConversation: translate('exportConversation'),
    renameConversation: translate('renameConversation'), memoryConsent: translate('memoryConsent'), saveMemory: translate('saveMemory'),
    cancel: translate('cancel'), confirmDraft: translate('confirmDraft'), draftExpires: translate('draftExpires'), error: translate('error'), noConversations: translate('noConversations'),
  }

  return <div className="p-4 sm:p-6 lg:p-8"><HeRaChat labels={labels} /></div>
}
