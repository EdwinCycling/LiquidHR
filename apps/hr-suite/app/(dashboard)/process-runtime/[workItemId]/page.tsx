import { redirect } from 'next/navigation'

interface ProcessRuntimePageProps {
  params: Promise<{ workItemId: string }>
}

export default async function ProcessRuntimePage({ params }: ProcessRuntimePageProps) {
  const { workItemId } = await params
  redirect(`/work/${workItemId}`)
}
