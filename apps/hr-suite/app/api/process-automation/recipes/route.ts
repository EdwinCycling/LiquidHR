import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import {
  activateCertifiedRecipe,
  listCertifiedRecipes,
  processRecipeErrorResponse,
} from '@/lib/process-automation/recipe-service'

const inputSchema = z.object({
  recipeId: z.string().uuid(),
  key: z.string().trim().regex(/^[a-z][a-z0-9_-]*$/).max(80).optional(),
}).strict()

export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json({ data: await listCertifiedRecipes() })
  } catch (error) {
    return permissionErrorResponse(error)
      ?? processRecipeErrorResponse(error)
      ?? NextResponse.json({ code: 'PROCESS_RECIPE_OPERATION_FAILED' }, { status: 500 })
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const parsed = inputSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ code: 'PROCESS_RECIPE_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await activateCertifiedRecipe(parsed.data.recipeId, parsed.data.key) }, { status: 201 })
  } catch (error) {
    return permissionErrorResponse(error)
      ?? processRecipeErrorResponse(error)
      ?? NextResponse.json({ code: 'PROCESS_RECIPE_OPERATION_FAILED' }, { status: 500 })
  }
}
