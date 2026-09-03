import type { Metadata } from 'next'
import legalMessages from '@/messages/en/legal.json'
import { LegalDocument } from '@/components/legal/legal-document'

export const metadata: Metadata = {
  title: legalMessages.terms.metadataTitle,
  description: legalMessages.terms.description,
}

export default function TermsPage() {
  return <LegalDocument document={legalMessages.terms} otherHref="/privacy" otherLabel={legalMessages.shared.privacyLink} />
}
