import type { Metadata } from 'next'
import legalMessages from '@/messages/en/legal.json'
import { LegalDocument } from '@/components/legal/legal-document'

export const metadata: Metadata = {
  title: legalMessages.privacy.metadataTitle,
  description: legalMessages.privacy.description,
}

export default function PrivacyPage() {
  return <LegalDocument document={legalMessages.privacy} otherHref="/terms" otherLabel={legalMessages.shared.termsLink} />
}
