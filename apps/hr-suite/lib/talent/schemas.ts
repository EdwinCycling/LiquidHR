import { z } from 'zod'

const capabilityType = z.enum(['COMPETENCY', 'SKILL', 'KNOWLEDGE', 'LANGUAGE', 'CERTIFICATE'])
const capabilityTypes = z.array(capabilityType).min(1).max(5)
const status = z.enum(['ACTIVE', 'INACTIVE'])
const uuid = z.string().uuid()
const databaseUuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
const cefr = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])

function validateCapabilitySpecificFields(
  value: {
    capabilityType: z.infer<typeof capabilityType>
    languageCode?: string | null
    languageCefr?: z.infer<typeof cefr> | null
    languageIsNative?: boolean
    certificateIssuingBody?: string | null
    certificateValidityMonths?: number | null
    certificateIsPermanent?: boolean
    certificateCode?: string | null
    certificateRenewalRequired?: boolean
  },
  context: z.RefinementCtx,
) {
  const hasLanguageFields = Boolean(value.languageCode || value.languageCefr || value.languageIsNative)
  const hasCertificateFields = Boolean(
    value.certificateIssuingBody
    || value.certificateValidityMonths
    || value.certificateIsPermanent
    || value.certificateCode
    || value.certificateRenewalRequired,
  )
  if (value.capabilityType === 'LANGUAGE' && hasCertificateFields) {
    context.addIssue({ code: 'custom', path: ['capabilityType'], message: 'LANGUAGE_CERTIFICATE_FIELDS_NOT_ALLOWED' })
  }
  if (value.capabilityType === 'CERTIFICATE' && hasLanguageFields) {
    context.addIssue({ code: 'custom', path: ['capabilityType'], message: 'CERTIFICATE_LANGUAGE_FIELDS_NOT_ALLOWED' })
  }
  if (['COMPETENCY', 'SKILL', 'KNOWLEDGE'].includes(value.capabilityType) && (hasLanguageFields || hasCertificateFields)) {
    context.addIssue({ code: 'custom', path: ['capabilityType'], message: 'CAPABILITY_TYPE_SPECIFIC_FIELDS_NOT_ALLOWED' })
  }
  if (value.capabilityType === 'CERTIFICATE' && value.certificateIsPermanent && value.certificateValidityMonths) {
    context.addIssue({ code: 'custom', path: ['certificateValidityMonths'], message: 'PERMANENT_CERTIFICATE_CANNOT_HAVE_VALIDITY' })
  }
}

export const talentSeniorityCreateSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).nullish(),
  sortOrder: z.number().int().min(1).max(999).default(1),
}).strict()

export const talentSeniorityUpdateSchema = z.object({
  code: z.string().trim().min(1).max(40).optional(),
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  sortOrder: z.number().int().min(1).max(999).optional(),
  status: status.optional(),
}).strict().refine((value) => Object.keys(value).length > 0)

export const talentLevelModelUpdateSchema = z.object({
  code: z.string().trim().min(1).max(40).optional(),
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  status: status.optional(),
}).strict().refine((value) => Object.keys(value).length > 0)

export const talentLevelCreateSchema = z.object({
  levelModelId: uuid,
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).nullish(),
  sortOrder: z.number().int().min(1).max(999),
}).strict()

export const talentLevelUpdateSchema = z.object({
  code: z.string().trim().min(1).max(40).optional(),
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  sortOrder: z.number().int().min(1).max(999).optional(),
}).strict().refine((value) => Object.keys(value).length > 0)

export const talentLevelReorderSchema = z.object({
  levelIds: z.array(uuid).min(1).max(20),
}).strict()

export const talentCategoryCreateSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).nullish(),
  capabilityTypes,
}).strict().superRefine((value, context) => {
  if (new Set(value.capabilityTypes).size !== value.capabilityTypes.length) context.addIssue({ code: 'custom', path: ['capabilityTypes'], message: 'DUPLICATE_CAPABILITY_TYPE' })
})

export const talentCategoryUpdateSchema = z.object({
  code: z.string().trim().min(1).max(40).optional(),
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  capabilityTypes: capabilityTypes.optional(),
  status: status.optional(),
}).strict().refine((value) => Object.keys(value).length > 0)

const talentCapabilityFields = {
  capabilityType,
  code: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullish(),
  categoryId: z.string().uuid().nullish(),
  languageCode: z.string().trim().max(20).nullish(),
  languageCefr: cefr.nullish(),
  languageIsNative: z.boolean().optional().default(false),
  certificateIssuingBody: z.string().trim().max(200).nullish(),
  certificateValidityMonths: z.number().int().min(1).max(1200).nullish(),
  certificateIsPermanent: z.boolean().optional().default(false),
  certificateCode: z.string().trim().max(120).nullish(),
  certificateRenewalRequired: z.boolean().optional().default(false),
}

export const talentCapabilityCreateSchema = z.object(talentCapabilityFields).strict().superRefine(validateCapabilitySpecificFields)

export const talentCapabilityUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  languageCode: z.string().trim().max(20).nullable().optional(),
  languageCefr: cefr.nullable().optional(),
  languageIsNative: z.boolean().optional(),
  certificateIssuingBody: z.string().trim().max(200).nullable().optional(),
  certificateValidityMonths: z.number().int().min(1).max(1200).nullable().optional(),
  certificateIsPermanent: z.boolean().optional(),
  certificateCode: z.string().trim().max(120).nullable().optional(),
  certificateRenewalRequired: z.boolean().optional(),
  status: status.optional(),
}).strict().refine((value) => Object.keys(value).length > 0)

export const talentCapabilityLevelContentSchema = z.object({
  talentLevelId: uuid,
  indicatorText: z.string().trim().min(1).max(4000),
  examples: z.string().trim().max(4000).nullable().optional(),
  coachingNotes: z.string().trim().max(4000).nullable().optional(),
}).strict()

export const talentCapabilityTagSchema = z.object({
  tagId: uuid,
}).strict()

export const talentCapabilityListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  capabilityType: capabilityType.optional(),
  categoryId: uuid.optional(),
  status: status.optional(),
  tagId: uuid.optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
}).strict()

export const jobFamilyCreateSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).nullish(),
}).strict()

export const jobFamilyUpdateSchema = z.object({
  code: z.string().trim().min(1).max(40).optional(),
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  status: status.optional(),
}).strict().refine((value) => Object.keys(value).length > 0)

export const jobProfileCreateSchema = z.object({
  jobId: z.string().uuid(),
  purpose: z.string().trim().max(4000).nullish(),
  summary: z.string().trim().max(4000).nullish(),
}).strict()

export const jobProfileVersionUpdateSchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE']).optional(),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  updatedAt: z.iso.datetime({ offset: true }).optional(),
  purpose: z.string().trim().max(4000).nullish(),
  summary: z.string().trim().max(4000).nullish(),
  organizationalContext: z.string().trim().max(4000).nullish(),
  tasks: z.array(z.string().trim().min(1).max(1000)).max(100).optional(),
  responsibilities: z.array(z.string().trim().min(1).max(1000)).max(100).optional(),
  resultAreas: z.array(z.string().trim().min(1).max(1000)).max(100).optional(),
}).strict().refine((value) => Object.keys(value).length > 0)

export const jobProfileRequirementCreateSchema = z.object({
  capabilityId: uuid,
  requirementType: z.enum(['REQUIRED', 'IMPORTANT', 'OPTIONAL']),
  targetLevelId: uuid.nullish(),
  languageLevel: cefr.nullish(),
  certificateDetails: z.record(z.string(), z.unknown()).nullish(),
  rationale: z.string().trim().max(2000).nullish(),
  sortOrder: z.number().int().min(1).max(999),
}).strict()

export const jobProfileRequirementUpdateSchema = jobProfileRequirementCreateSchema.partial().strict().refine((value) => Object.keys(value).length > 0)

export const jobProfileVersionCopySchema = z.object({
  sourceVersionId: uuid.optional(),
}).strict()

export const jobProfileVersionActivateSchema = z.object({
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  updatedAt: z.iso.datetime({ offset: true }).optional(),
}).strict()

export type TalentSeniorityCreateInput = z.infer<typeof talentSeniorityCreateSchema>
export type TalentSeniorityUpdateInput = z.infer<typeof talentSeniorityUpdateSchema>
export type TalentLevelModelUpdateInput = z.infer<typeof talentLevelModelUpdateSchema>
export type TalentLevelCreateInput = z.infer<typeof talentLevelCreateSchema>
export type TalentLevelUpdateInput = z.infer<typeof talentLevelUpdateSchema>
export type TalentLevelReorderInput = z.infer<typeof talentLevelReorderSchema>
export type TalentCategoryCreateInput = z.infer<typeof talentCategoryCreateSchema>
export type TalentCategoryUpdateInput = z.infer<typeof talentCategoryUpdateSchema>
export type TalentCapabilityCreateInput = z.infer<typeof talentCapabilityCreateSchema>
export type TalentCapabilityUpdateInput = z.infer<typeof talentCapabilityUpdateSchema>
export type TalentCapabilityLevelContentInput = z.infer<typeof talentCapabilityLevelContentSchema>
export type TalentCapabilityTagInput = z.infer<typeof talentCapabilityTagSchema>
export type JobFamilyCreateInput = z.infer<typeof jobFamilyCreateSchema>
export type JobFamilyUpdateInput = z.infer<typeof jobFamilyUpdateSchema>
export type JobProfileCreateInput = z.infer<typeof jobProfileCreateSchema>
export type JobProfileVersionUpdateInput = z.infer<typeof jobProfileVersionUpdateSchema>
export type JobProfileRequirementCreateInput = z.infer<typeof jobProfileRequirementCreateSchema>
export type JobProfileRequirementUpdateInput = z.infer<typeof jobProfileRequirementUpdateSchema>
export type JobProfileVersionCopyInput = z.infer<typeof jobProfileVersionCopySchema>
export type JobProfileVersionActivateInput = z.infer<typeof jobProfileVersionActivateSchema>

const talentEmployeeCapabilitySourceType = z.enum(['SELF_ENTERED', 'HR_ENTERED', 'MANAGER_ENTERED', 'IMPORTED'])
const talentEmployeeCapabilityStatus = z.enum(['DRAFT', 'RELEASED', 'EXPIRED', 'ARCHIVED'])
const certificateStatus = z.enum(['VALID', 'EXPIRED', 'PERMANENT', 'REVOKED'])
const qualificationEvidenceStatus = z.enum(['NOT_PROVIDED', 'PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED'])
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const talentEmployeeCapabilityValueFields = {
  capabilityId: databaseUuid,
  talentLevelId: databaseUuid.nullish(),
  languageLevel: cefr.nullish(),
  languageIsNative: z.boolean().optional().default(false),
  certificateStatus: certificateStatus.nullish(),
  validFrom: isoDate,
  validUntil: isoDate.nullish(),
  evidenceDocumentId: databaseUuid.nullish(),
}

const talentEmployeeCapabilityQualificationCreateFields = {
  certificateIssuingBody: z.string().trim().max(200).nullish(),
  certificateCode: z.string().trim().max(120).nullish(),
  certificateValidityMonths: z.number().int().min(1).max(1200).nullish(),
  certificateIsPermanent: z.boolean().optional().default(false),
  certificateRenewalRequired: z.boolean().optional().default(false),
  evidenceStatus: qualificationEvidenceStatus.nullish(),
  qualificationResponsibleUserId: databaseUuid.nullish(),
}

const talentEmployeeCapabilityQualificationUpdateFields = {
  certificateIssuingBody: z.string().trim().max(200).nullable().optional(),
  certificateCode: z.string().trim().max(120).nullable().optional(),
  certificateValidityMonths: z.number().int().min(1).max(1200).nullable().optional(),
  certificateIsPermanent: z.boolean().optional(),
  certificateRenewalRequired: z.boolean().optional(),
  evidenceStatus: qualificationEvidenceStatus.nullable().optional(),
  qualificationResponsibleUserId: databaseUuid.nullable().optional(),
}

function validateTalentEmployeeCapabilityDates(
  value: { validFrom: string; validUntil?: string | null },
  context: z.RefinementCtx,
) {
  if (value.validUntil && value.validUntil <= value.validFrom) {
    context.addIssue({ code: 'custom', path: ['validUntil'], message: 'VALID_UNTIL_MUST_BE_AFTER_VALID_FROM' })
  }
}

function validateTalentEmployeeCapabilityQualification(
  value: {
    certificateStatus?: z.infer<typeof certificateStatus> | null
    certificateIsPermanent?: boolean
    validUntil?: string | null
    evidenceStatus?: z.infer<typeof qualificationEvidenceStatus> | null
    evidenceDocumentId?: string | null
  },
  context: z.RefinementCtx,
) {
  if (value.certificateIsPermanent && value.certificateStatus !== 'PERMANENT') {
    context.addIssue({ code: 'custom', path: ['certificateStatus'], message: 'PERMANENT_CERTIFICATE_STATUS_REQUIRED' })
  }
  if (value.certificateStatus === 'PERMANENT' && value.validUntil) {
    context.addIssue({ code: 'custom', path: ['validUntil'], message: 'PERMANENT_CERTIFICATE_CANNOT_HAVE_END_DATE' })
  }
  if (value.evidenceStatus === 'VERIFIED' && !value.evidenceDocumentId) {
    context.addIssue({ code: 'custom', path: ['evidenceStatus'], message: 'VERIFIED_EVIDENCE_REFERENCE_REQUIRED' })
  }
  if (value.evidenceStatus === 'NOT_PROVIDED' && value.evidenceDocumentId) {
    context.addIssue({ code: 'custom', path: ['evidenceStatus'], message: 'EVIDENCE_STATUS_MUST_REFLECT_REFERENCE' })
  }
}

export const talentEmployeeCapabilitySelfCreateSchema = z.object(talentEmployeeCapabilityValueFields)
  .strict()
  .superRefine(validateTalentEmployeeCapabilityDates)

export const talentEmployeeCapabilityAdminCreateSchema = z.object({
  employeeId: databaseUuid,
  sourceType: talentEmployeeCapabilitySourceType.default('HR_ENTERED'),
  status: talentEmployeeCapabilityStatus.default('DRAFT'),
  ...talentEmployeeCapabilityValueFields,
  ...talentEmployeeCapabilityQualificationCreateFields,
}).strict().superRefine((value, context) => {
  validateTalentEmployeeCapabilityDates(value, context)
  validateTalentEmployeeCapabilityQualification(value, context)
})

export const talentEmployeeCapabilitySelfUpdateSchema = z.object({
  version: z.number().int().min(1),
  ...talentEmployeeCapabilityValueFields,
}).strict().superRefine(validateTalentEmployeeCapabilityDates)

export const talentEmployeeCapabilityAdminUpdateSchema = z.object({
  version: z.number().int().min(1),
  status: talentEmployeeCapabilityStatus.optional(),
  ...talentEmployeeCapabilityValueFields,
  ...talentEmployeeCapabilityQualificationUpdateFields,
}).strict().superRefine((value, context) => {
  validateTalentEmployeeCapabilityDates(value, context)
  validateTalentEmployeeCapabilityQualification(value, context)
})

export const talentEmployeeCapabilityListQuerySchema = z.object({
  employeeId: databaseUuid.optional(),
  status: talentEmployeeCapabilityStatus.optional(),
  sourceType: talentEmployeeCapabilitySourceType.optional(),
  capabilityType: capabilityType.optional(),
}).strict()

export type TalentEmployeeCapabilitySelfCreateInput = z.infer<typeof talentEmployeeCapabilitySelfCreateSchema>
export type TalentEmployeeCapabilityAdminCreateInput = z.infer<typeof talentEmployeeCapabilityAdminCreateSchema>
export type TalentEmployeeCapabilitySelfUpdateInput = z.infer<typeof talentEmployeeCapabilitySelfUpdateSchema>
export type TalentEmployeeCapabilityAdminUpdateInput = z.infer<typeof talentEmployeeCapabilityAdminUpdateSchema>
export type TalentEmployeeCapabilityListQuery = z.infer<typeof talentEmployeeCapabilityListQuerySchema>
