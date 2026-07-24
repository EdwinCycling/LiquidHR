import { z } from 'zod'

export const employeeActivityMessageSchema = z.string().trim().min(1).max(2_000)
