import { z } from 'zod'

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const nullableText = (maximum: number) => z.string().trim().max(maximum).nullable().optional()

export const departmentCreateSchema = z.object({
  code: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().trim().min(1).max(160),
  description: nullableText(500),
  parentId: z.uuid().nullable().optional(),
}).strict()

export const departmentUpdateSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  description: nullableText(500),
  parentId: z.uuid().nullable().optional(),
  isActive: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0)

export const roleCreateSchema = z.object({
  code: z.string().trim().min(2).max(50).regex(/^[A-Z][A-Z0-9_]+$/),
  name: z.string().trim().min(1).max(120),
  description: nullableText(500),
  deputyRoleId: z.uuid().nullable().optional(),
}).strict()

export const roleUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: nullableText(500),
  deputyRoleId: z.uuid().nullable().optional(),
  isActive: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0)

export const rolePermissionsSchema = z.object({ permissionIds: z.array(z.uuid()).max(250) }).strict()

const placementShape = {
  employeeId: z.uuid(), employmentId: z.uuid().nullable().optional(), departmentId: z.uuid(),
  directManagerId: z.uuid().nullable().optional(), directManagerDeputyId: z.uuid().nullable().optional(),
  jobTitle: nullableText(160), costBearer: nullableText(120), effectiveFrom: dateOnly,
  effectiveTo: dateOnly.nullable().optional(),
}

export const placementCreateSchema = z.object(placementShape).strict().superRefine((value, context) => {
  if (value.effectiveTo && value.effectiveTo < value.effectiveFrom) context.addIssue({ code: 'custom', path: ['effectiveTo'], message: 'DATE_RANGE_INVALID' })
  if (value.directManagerId === value.employeeId || value.directManagerDeputyId === value.employeeId) context.addIssue({ code: 'custom', path: ['directManagerId'], message: 'MANAGER_SELF_INVALID' })
})

export const placementUpdateSchema = z.object({
  employmentId: placementShape.employmentId,
  departmentId: placementShape.departmentId,
  directManagerId: placementShape.directManagerId,
  directManagerDeputyId: placementShape.directManagerDeputyId,
  jobTitle: placementShape.jobTitle,
  costBearer: placementShape.costBearer,
  effectiveFrom: placementShape.effectiveFrom,
  effectiveTo: placementShape.effectiveTo,
}).partial().strict()
  .refine((value) => Object.keys(value).length > 0)

export const managementAssignmentCreateSchema = z.object({
  departmentId: z.uuid(), managementRoleId: z.uuid(), employeeId: z.uuid(),
  effectiveFrom: dateOnly, effectiveTo: dateOnly.nullable().optional(),
}).strict().superRefine((value, context) => {
  if (value.effectiveTo && value.effectiveTo < value.effectiveFrom) context.addIssue({ code: 'custom', path: ['effectiveTo'], message: 'DATE_RANGE_INVALID' })
})

export const managementAssignmentUpdateSchema = z.object({
  effectiveFrom: dateOnly.optional(), effectiveTo: dateOnly.nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0)

export type DepartmentCreateInput = z.infer<typeof departmentCreateSchema>
export type DepartmentUpdateInput = z.infer<typeof departmentUpdateSchema>
export type RoleCreateInput = z.infer<typeof roleCreateSchema>
export type RoleUpdateInput = z.infer<typeof roleUpdateSchema>
export type PlacementCreateInput = z.infer<typeof placementCreateSchema>
export type PlacementUpdateInput = z.infer<typeof placementUpdateSchema>
export type ManagementAssignmentCreateInput = z.infer<typeof managementAssignmentCreateSchema>
export type ManagementAssignmentUpdateInput = z.infer<typeof managementAssignmentUpdateSchema>
