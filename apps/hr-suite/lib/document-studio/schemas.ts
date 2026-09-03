import { z } from 'zod'
import {
  TEMPLATE_KINDS,
  TEMPLATE_LANGUAGES,
  documentStudioCategorySchema,
  type TemplateKind,
  type TemplateLanguage,
} from './canonical-document'

export const templateKindSchema = z.enum(TEMPLATE_KINDS)
export const templateLanguageSchema = z.enum(TEMPLATE_LANGUAGES)
export const documentStudioCategorySchemaV1 = documentStudioCategorySchema

export const localizedTextSchema = z.object({
  nl: z.string().trim().min(1).max(4000),
  en: z.string().trim().min(1).max(4000),
})

export const templateMetadataSchema = z.object({
  templateKey: z.string().regex(/^[a-z][a-z0-9_-]{0,79}$/),
  kind: templateKindSchema,
  language: templateLanguageSchema,
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000).nullable(),
  documentTypeId: z.string().uuid(),
  categoryCode: documentStudioCategorySchemaV1,
  defaultDossier: z.boolean(),
  documentProfileId: z.string().uuid().nullable(),
})

export const compositionItemSchema = z.object({
  kind: z.enum(['COVER', 'APPENDIX']),
  versionId: z.string().uuid(),
  sortOrder: z.number().int().min(0),
})

export const draftPayloadSchema = z.object({
  draftVersionId: z.string().uuid(),
  expectedRevision: z.number().int().min(1),
  idempotencyKey: z.string().uuid(),
  metadata: templateMetadataSchema.partial().omit({ templateKey: true, kind: true, language: true }),
  document: z.unknown(),
  composition: z.array(compositionItemSchema).max(201),
  assetRefs: z.array(z.string().uuid()).max(200),
})

export const createTemplatePayloadSchema = z.object({
  idempotencyKey: z.string().uuid(),
  metadata: templateMetadataSchema,
  document: z.unknown(),
  composition: z.array(compositionItemSchema).max(201),
  assetRefs: z.array(z.string().uuid()).max(200),
})

export const archiveTemplatePayloadSchema = z.object({
  idempotencyKey: z.string().uuid(),
})

export const templateMetadataUpdateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000).nullable(),
})

export const validateDraftPayloadSchema = z.object({
  draftVersionId: z.string().uuid(),
  expectedRevision: z.number().int().min(1),
})

export const assetUploadMetadataSchema = z.object({
  filename: z.string().trim().min(1).max(180),
})

const documentTypeInputBaseSchema = z.object({
  code: z.string().regex(/^[a-z][a-z0-9_-]{0,79}$/),
  name: localizedTextSchema,
  description: z.object({ nl: z.string().max(4000), en: z.string().max(4000) }),
  retentionKind: z.enum(['PERMANENT', 'YEARS']),
  retentionYears: z.number().int().min(1).max(100).nullable(),
  isActive: z.boolean(),
})

export const documentTypeInputSchema = documentTypeInputBaseSchema.superRefine((value, context) => {
  if (value.retentionKind === 'PERMANENT' && value.retentionYears !== null) context.addIssue({ code: 'custom', path: ['retentionYears'], message: 'PERMANENT_RETENTION_YEARS' })
  if (value.retentionKind === 'YEARS' && value.retentionYears === null) context.addIssue({ code: 'custom', path: ['retentionYears'], message: 'YEARS_RETENTION_REQUIRED' })
})

export const documentProfileInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  sourceAdministrationId: z.string().uuid(),
  logoAssetId: z.string().uuid().nullable(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
})

export const documentTypeUpdateSchema = documentTypeInputBaseSchema.partial()
export const documentProfileUpdateSchema = documentProfileInputSchema.partial()

export type TemplateMetadata = z.infer<typeof templateMetadataSchema>
export type CreateTemplatePayload = z.infer<typeof createTemplatePayloadSchema>
export type DraftPayload = z.infer<typeof draftPayloadSchema>
export type CompositionItem = z.infer<typeof compositionItemSchema>
export type DocumentStudioKind = TemplateKind
export type DocumentStudioLanguage = TemplateLanguage
