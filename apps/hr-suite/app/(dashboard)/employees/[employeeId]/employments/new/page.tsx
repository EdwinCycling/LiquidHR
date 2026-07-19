import { redirect } from 'next/navigation'
export default async function NewEmploymentPage({ params }: { params: Promise<{ employeeId: string }> }) { redirect(`/employees/${(await params).employeeId}?tab=employments&create=1`) }
