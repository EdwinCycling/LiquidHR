import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { PublicVacancyProjection } from './domain'
import { recruitmentDatabaseError } from './errors'

type PublicRecruitmentDatabase = {
  public: {
    Tables: Record<never, never>
    Views: Record<never, never>
    Functions: {
      recruitment_public_vacancy: {
        Args: { requested_publication_id: string; requested_slug: string }
        Returns: Array<{ publication_id: string; slug: string; title: string; location: string | null; content: unknown }>
      }
    }
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}

const publicVacancySchema = z.object({
  publication_id: z.guid(),
  slug: z.string(),
  title: z.string(),
  location: z.string().nullable(),
  content: z.record(z.string(), z.unknown()),
})

export async function getPublicVacancy(publicationId: string, slug: string): Promise<PublicVacancyProjection | null> {
  const client = await createClient() as unknown as SupabaseClient<PublicRecruitmentDatabase>
  const result = await client.rpc('recruitment_public_vacancy', {
    requested_publication_id: publicationId,
    requested_slug: slug,
  })
  if (result.error) throw recruitmentDatabaseError(result.error)
  const row = result.data?.[0]
  if (!row) return null
  const parsed = publicVacancySchema.parse(row)
  return {
    publicationId: parsed.publication_id,
    slug: parsed.slug,
    title: parsed.title,
    location: parsed.location,
    content: parsed.content,
  }
}
