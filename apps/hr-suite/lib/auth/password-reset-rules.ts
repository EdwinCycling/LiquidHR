import { z } from 'zod'

export const passwordResetSchema = z
  .object({
    password: z.string().min(12).max(72),
    passwordConfirmation: z.string().min(12).max(72),
  })
  .strict()
  .refine((value) => value.password === value.passwordConfirmation, {
    path: ['passwordConfirmation'],
    message: 'PASSWORD_MISMATCH',
  })

export type PasswordResetInput = z.infer<typeof passwordResetSchema>
