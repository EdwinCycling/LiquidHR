import { NextResponse } from 'next/server'
import { getPublicVacancy, getPublicVacancyState } from '@/lib/recruitment/public-repository'
import { recruitmentGuidSchema } from '@/lib/recruitment/domain'

export async function GET(_request: Request, { params }: { params: Promise<{ publicId: string }> }): Promise<NextResponse> {
  const { publicId } = await params
  const parsed = recruitmentGuidSchema.safeParse(publicId)
  if (!parsed.success) return NextResponse.json({ code: 'RECRUITMENT_PUBLIC_VACANCY_NOT_FOUND' }, { status: 404 })
  const url = new URL(_request.url)
  const slug = url.searchParams.get('slug') ?? ''
  const vacancy = await getPublicVacancy(parsed.data, slug)
  if (vacancy) return NextResponse.json({ data: vacancy }, { headers: { 'Cache-Control': 'no-store' } })
  const state = await getPublicVacancyState(parsed.data, slug)
  if (!state) return NextResponse.json({ code: 'RECRUITMENT_PUBLIC_VACANCY_NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ data: state }, { headers: { 'Cache-Control': 'no-store' } })
}
