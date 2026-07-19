'use client'

import { Archive, ArchiveRestore } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Labels {
  archive: string
  unarchive: string
  archiveTitle: string
  unarchiveTitle: string
  archiveBody: string
  archiveAction: string
  cancel: string
  saved: string
  failed: string
}

export function EmployeeArchiveToggle({ employeeId, archived, labels }: { employeeId: string; archived: boolean; labels: Labels }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const nextArchived = !archived

  async function confirmChange() {
    setSaving(true)
    setFailed(false)
    const response = await fetch(`/api/employees/${employeeId}/archive`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ archived: nextArchived }),
    })
    setSaving(false)
    if (!response.ok) {
      setFailed(true)
      return
    }
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button type="button" className="button-secondary gap-2" onClick={() => setOpen(true)}>
        {archived ? <ArchiveRestore aria-hidden="true" className="h-4 w-4" /> : <Archive aria-hidden="true" className="h-4 w-4" />}
        {archived ? labels.unarchive : labels.archive}
      </button>
      {open && <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4" role="presentation">
        <div className="w-full max-w-md rounded-2xl border bg-surface p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="archive-dialog-title">
          <h2 id="archive-dialog-title" className="text-lg font-semibold">{archived ? labels.unarchiveTitle : labels.archiveTitle}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{labels.archiveBody}</p>
          {failed && <p className="mt-3 text-sm text-destructive">{labels.failed}</p>}
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" className="button-secondary" disabled={saving} onClick={() => setOpen(false)}>{labels.cancel}</button>
            <button type="button" className="button-primary" disabled={saving} onClick={() => void confirmChange()}>{saving ? labels.saved : labels.archiveAction}</button>
          </div>
        </div>
      </div>}
    </>
  )
}
