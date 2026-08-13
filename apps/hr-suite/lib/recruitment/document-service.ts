import { RecruitmentError } from './errors'
import { validateRecruitmentDocument, type BotChallengeAdapter, type MalwareScannerAdapter, type RecruitmentDocument } from './public-security'

export interface RecruitmentDocumentStorage {
  uploadQuarantined(path: string, document: RecruitmentDocument): Promise<void>
  remove(path: string): Promise<void>
  createSignedUrlForDocument(documentId: string, expiresInSeconds: number): Promise<string>
}

export interface RecruitmentDocumentClaims {
  downloadClaim(documentId: string): Promise<{ readonly documentId: string } | null>
}

export function createRecruitmentDocumentService(dependencies: {
  readonly bot: BotChallengeAdapter
  readonly scanner: MalwareScannerAdapter
  readonly storage: RecruitmentDocumentStorage
  readonly claims: RecruitmentDocumentClaims
}) {
  return {
    async quarantineAndScan(input: { readonly challengeToken: string; readonly path: string; readonly document: RecruitmentDocument }) {
      const challenge = await dependencies.bot.verify(input.challengeToken)
      if (!challenge.ok) throw new RecruitmentError(challenge.code, challenge.code.includes('UNAVAILABLE') ? 503 : 422)
      const validation = validateRecruitmentDocument(input.document)
      if (!validation.ok) throw new RecruitmentError(validation.code, 422)
      await dependencies.storage.uploadQuarantined(input.path, input.document)
      const scan = await dependencies.scanner.scan(input.document)
      if (scan.status !== 'CLEAN') {
        await dependencies.storage.remove(input.path)
        throw new RecruitmentError(scan.status === 'UNAVAILABLE' ? 'RECRUITMENT_MALWARE_SCANNER_UNAVAILABLE' : 'RECRUITMENT_DOCUMENT_REJECTED', scan.status === 'UNAVAILABLE' ? 503 : 422)
      }
      return { storageKey: input.path, scanStatus: 'CLEAN' as const, scannerReference: scan.reference, detectedType: validation.detectedType }
    },
    async signedDownload(documentId: string) {
      const claim = await dependencies.claims.downloadClaim(documentId)
      if (!claim) throw new RecruitmentError('RECRUITMENT_DOCUMENT_NOT_FOUND', 404)
      return dependencies.storage.createSignedUrlForDocument(claim.documentId, 60)
    },
  }
}
