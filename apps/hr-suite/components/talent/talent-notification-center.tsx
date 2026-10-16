'use client'

import { Bell } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { TalentNotificationPanel } from '@/components/talent/talent-notification-panel'

type NotificationLabels = Parameters<typeof TalentNotificationPanel>[0]['labels']

export function TalentNotificationCenter({ labels, counterLabel, closeLabel }: {
  labels: NotificationLabels
  counterLabel: string
  closeLabel: string
}) {
  const [count, setCount] = useState<number | null>(null)
  const [open, setOpen] = useState(false)
  const updateCount = useCallback((nextCount: number) => setCount(nextCount), [])

  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/talent/notifications?summary=true', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return
        const payload = await response.json() as { count: number }
        if (!controller.signal.aborted) setCount(payload.count)
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

  return <>
    <div className="mt-4 flex justify-end">
      <Button aria-haspopup="dialog" onClick={() => setOpen(true)} size="sm" type="button" variant="secondary">
        <Bell aria-hidden="true" />
        {counterLabel}
        <Badge className="ml-1" tone={count ? 'warning' : 'neutral'}>{count ?? '—'}</Badge>
      </Button>
    </div>
    <Dialog closeLabel={closeLabel} description={labels.intro} onOpenChange={setOpen} open={open} panelClassName="max-w-3xl" title={labels.title}>
      {open ? <TalentNotificationPanel compact labels={labels} onOpenCountChange={updateCount} /> : null}
    </Dialog>
  </>
}
