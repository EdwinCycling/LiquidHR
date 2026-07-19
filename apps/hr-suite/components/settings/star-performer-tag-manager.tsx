'use client'

import { type FormEvent, useMemo, useState } from 'react'
import { PencilLine, Tag } from 'lucide-react'
import type { StarPerformerTag } from '@/lib/star-performers/service'

interface StarPerformerTagManagerLabels {
  tagManagerCardTitle: string
  tagName: string
  tagActive: string
  inactive: string
  createTag: string
  updateTag: string
  editTag: string
  newTag: string
  usageCount: string
  tagListTitle: string
  tagSearchPlaceholder: string
  tagEmpty: string
  tagSaved: string
  tagSaveFailed: string
}

export function StarPerformerTagManager({
  initialTags,
  labels,
}: {
  initialTags: StarPerformerTag[]
  labels: StarPerformerTagManagerLabels
}) {
  const [tags, setTags] = useState(initialTags)
  const [search, setSearch] = useState('')
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const visibleTags = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('nl-NL')
    if (!q) return tags
    return tags.filter((tag) => tag.name.toLocaleLowerCase('nl-NL').includes(q))
  }, [search, tags])

  function startEdit(tag: StarPerformerTag) {
    setEditingTagId(tag.id)
    setName(tag.name)
    setIsActive(tag.isActive)
    setFeedback(null)
  }

  function resetForm() {
    setEditingTagId(null)
    setName('')
    setIsActive(true)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setFeedback(null)

    const response = await fetch(
      editingTagId ? `/api/star-performer-tags/${editingTagId}` : '/api/star-performer-tags',
      {
        method: editingTagId ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(editingTagId ? { name, isActive } : { name }),
      },
    )

    setSaving(false)
    if (!response.ok) {
      setFeedback(labels.tagSaveFailed)
      return
    }

    if (editingTagId) {
      setTags((current) => current.map((tag) => (
        tag.id === editingTagId
          ? { ...tag, name: name.trim(), isActive }
          : tag
      )))
    } else {
      const payload = await response.json() as { data: { id: string } }
      setTags((current) => [...current, {
        id: payload.data.id,
        name: name.trim(),
        isActive: true,
        usageCount: 0,
      }].sort((left, right) => left.name.localeCompare(right.name, 'nl-NL')))
    }

    setFeedback(labels.tagSaved)
    resetForm()
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
      <section className="rounded-2xl border bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-accent text-primary">
            <Tag size={20} />
          </span>
          <div>
            <h2 className="text-lg font-semibold">{labels.tagManagerCardTitle}</h2>
            <button
              className="mt-1 text-sm font-semibold text-primary"
              onClick={resetForm}
              type="button"
            >
              {labels.newTag}
            </button>
          </div>
        </div>

        <form className="mt-5 space-y-4" onSubmit={(event) => void submit(event)}>
          <label className="block text-sm font-medium">
            {labels.tagName}
            <input
              className="form-field mt-1 h-10 min-h-10 w-full"
              onChange={(event) => setName(event.currentTarget.value)}
              required
              value={name}
            />
          </label>

          <label className="flex items-center justify-between rounded-xl border bg-background/70 px-4 py-3 text-sm">
            <span>{labels.tagActive}</span>
            <input
              checked={isActive}
              className="size-4"
              onChange={(event) => setIsActive(event.currentTarget.checked)}
              type="checkbox"
            />
          </label>

          <button
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            disabled={saving}
            type="submit"
          >
            {saving ? labels.updateTag : editingTagId ? labels.updateTag : labels.createTag}
          </button>
        </form>

        {feedback ? (
          <p className="mt-4 rounded-xl border px-4 py-3 text-sm">{feedback}</p>
        ) : null}
      </section>

      <section className="rounded-2xl border bg-surface p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold">{labels.tagListTitle}</h2>
          <input
            className="form-field h-10 min-h-10 w-full md:w-72"
            onChange={(event) => setSearch(event.currentTarget.value)}
            placeholder={labels.tagSearchPlaceholder}
            value={search}
          />
        </div>

        <div className="mt-5 space-y-3">
          {visibleTags.length === 0 ? (
            <p className="text-sm text-muted-foreground">{labels.tagEmpty}</p>
          ) : (
            visibleTags.map((tag) => (
              <article className="flex flex-col gap-3 rounded-2xl border bg-background/60 p-4 md:flex-row md:items-center md:justify-between" key={tag.id}>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{tag.name}</p>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tag.isActive ? 'bg-accent text-primary' : 'bg-muted text-muted-foreground'}`}>
                      {tag.isActive ? labels.tagActive : labels.inactive}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {labels.usageCount}: {tag.usageCount}
                  </p>
                </div>

                <button
                  className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold"
                  onClick={() => startEdit(tag)}
                  type="button"
                >
                  <PencilLine size={16} />
                  {labels.editTag}
                </button>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
