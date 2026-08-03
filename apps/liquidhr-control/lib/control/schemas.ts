import { z } from 'zod'
import { TENANT_LIFECYCLE_STATUSES } from './lifecycle'

export const administrationModeSchema = z.enum(['SEPARATE', 'COMBINED'])
export const lifecycleStatusSchema = z.enum(TENANT_LIFECYCLE_STATUSES)
export const uuidStringSchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
)

export const onboardingSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  administrationMode: administrationModeSchema,
  primaryContactEmail: z.email().transform((value) => value.toLowerCase()),
  administrations: z.array(z.object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]+$/).max(24),
    name: z.string().trim().min(2).max(120),
  })).min(1).max(25),
})

export const lifecycleCommandSchema = z.object({
  tenantId: uuidStringSchema,
  status: lifecycleStatusSchema,
  reason: z.string().trim().min(5).max(500),
})

export const supportSessionSchema = z.object({
  tenantId: uuidStringSchema,
  reason: z.string().trim().min(5).max(500),
  durationMinutes: z.coerce.number().int().refine((value) => [15, 30, 60].includes(value)),
})

export const snapshotTenantSchema = z.object({
  id: uuidStringSchema,
  name: z.string(),
  slug: z.string(),
  lifecycleStatus: lifecycleStatusSchema,
  administrationMode: administrationModeSchema,
  administrationCount: z.number().int().nonnegative(),
  employeeCount: z.number().int().nonnegative(),
  activeEmploymentCount: z.number().int().nonnegative(),
  userCount: z.number().int().nonnegative(),
  storageBytes: z.number().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
  primaryContactEmail: z.string().nullable(),
})

export const auditEntrySchema = z.object({
  id: uuidStringSchema,
  tenantId: uuidStringSchema.nullable(),
  tenantName: z.string().nullable(),
  action: z.string(),
  reason: z.string().nullable(),
  actorName: z.string(),
  createdAt: z.string(),
})

export const controlSnapshotSchema = z.object({
  operator: z.object({
    displayName: z.string(),
    role: z.enum(['OWNER', 'OPERATOR', 'AUDITOR']),
  }),
  totals: z.object({
    tenants: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
    paused: z.number().int().nonnegative(),
    employees: z.number().int().nonnegative(),
    users: z.number().int().nonnegative(),
    storageBytes: z.number().nonnegative(),
  }),
  tenants: z.array(snapshotTenantSchema),
  audit: z.array(auditEntrySchema),
})

export type ControlSnapshot = z.infer<typeof controlSnapshotSchema>
export type SnapshotTenant = z.infer<typeof snapshotTenantSchema>
