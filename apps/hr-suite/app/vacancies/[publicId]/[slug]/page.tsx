import { notFound } from 'next/navigation'
import { z } from 'zod'
import { getPublicVacancy } from '@/lib/recruitment/public-repository'

export default async function PublicVacancyBoundaryPage({ params }: { params: Promise<{ publicId: string; slug: string }> }) {
  const { publicId, slug } = await params
  const parsedId = z.guid().safeParse(publicId)
  if (!parsedId.success) notFound()
  const vacancy = await getPublicVacancy(parsedId.data, slug)
  if (!vacancy) notFound()
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-5 py-10 sm:py-16">
      <article className="rounded-2xl border bg-surface p-6 sm:p-10">
        <h1 className="text-3xl font-semibold tracking-tight">{vacancy.title}</h1>
        {vacancy.location ? <p className="mt-3 text-muted-foreground">{vacancy.location}</p> : null}
      </article>
    </main>
  )
}
