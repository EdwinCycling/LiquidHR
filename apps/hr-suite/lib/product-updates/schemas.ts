import { z } from 'zod'

export const productUpdateKindSchema = z.enum(['NEW_FEATURE', 'IMPROVEMENT'])
export const productUpdateChannelSchema = z.enum(['GIFT_WINDOW', 'LOGIN_POPUP', 'TOP_BANNER'])
export const productUpdateAudienceSchema = z.enum(['TENANT_ADMIN', 'DIRECT_MANAGER', 'EMPLOYEE'])
export const productUpdateScopeSchema = z.enum(['GLOBAL', 'TENANT'])
export const productUpdateSurfaceChannelSchema = z.enum(['LOGIN_POPUP', 'TOP_BANNER'])

export const productUpdateSchema = z.object({
  kind: productUpdateKindSchema,
  title: z.string().trim().min(1).max(180),
  summary: z.string().trim().min(1).max(320),
  content: z.string().trim().min(1).max(10000),
  startsAt: z.string().datetime({ offset: true }).nullable().optional(),
  endsAt: z.string().datetime({ offset: true }).nullable().optional(),
  displayChannels: z.array(productUpdateChannelSchema).min(1).max(3),
  audienceRoles: z.array(productUpdateAudienceSchema).min(1).max(3),
  isActive: z.boolean().default(true),
}).strict().superRefine((value, context) => {
  if (value.startsAt && value.endsAt && new Date(value.endsAt) < new Date(value.startsAt)) {
    context.addIssue({ code: 'custom', path: ['endsAt'], message: 'PRODUCT_UPDATE_END_BEFORE_START' })
  }
})

export type ProductUpdateInput = z.infer<typeof productUpdateSchema>
export const productUpdateMutationSchema = z.object({
  scope: productUpdateScopeSchema.default('TENANT'),
  update: productUpdateSchema,
}).strict()

export type ProductUpdateMutationInput = z.infer<typeof productUpdateMutationSchema>

export const productUpdateSurfaceSeenSchema = z.object({
  updateId: z.string().uuid(),
  channel: productUpdateSurfaceChannelSchema,
}).strict()

export type ProductUpdateSurfaceSeenInput = z.infer<typeof productUpdateSurfaceSeenSchema>
