import { redirect } from 'next/navigation'

export default function UpcomingEventsPage() {
  redirect('/insights?report=upcoming-events')
}
