import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { SavedAnalysisListItem } from '@/lib/insights/saved-analysis-definition'
import { MyAnalyses, type MyAnalysesLabels } from './my-analyses'

const labels: MyAnalysesLabels = {
  backToExplore: 'Go to Explore',
  cancel: 'Cancel',
  delete: 'Delete',
  deleteConfirm: 'Delete permanently',
  deleteDescription: 'This definition will be deleted:',
  deleteTitle: 'Delete analysis?',
  deleted: 'Deleted.',
  empty: 'No saved analyses',
  emptyDescription: 'Run and save one.',
  eyebrow: 'Liquid Analysis',
  intro: 'Personal definitions.',
  loadFailed: 'Could not load saved analyses.',
  open: 'Open and run again.',
  rename: 'Rename',
  renameDescription: 'Change the name only.',
  renameTitle: 'Rename analysis',
  save: 'Save name',
  saving: 'Saving name…',
  title: 'My analyses',
  updated: 'Updated.',
}

const item: SavedAnalysisListItem = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Medewerkers per afdeling',
  createdAt: '2026-08-30T12:00:00.000Z',
  updatedAt: '2026-08-30T12:00:00.000Z',
}

describe('Mijn analyses V1', () => {
  it('shows the explicit empty state and the Explore path', () => {
    const markup = renderToStaticMarkup(<MyAnalyses initialItems={[]} labels={labels} />)

    expect(markup).toContain('No saved analyses')
    expect(markup).toContain('href="/insights/analysis/explore"')
  })

  it('renders a personal list with open, rename and delete actions without result data', () => {
    const markup = renderToStaticMarkup(<MyAnalyses initialItems={[item]} labels={labels} />)

    expect(markup).toContain('Medewerkers per afdeling')
    expect(markup).toContain('href="/insights/analysis/my-analyses/11111111-1111-4111-8111-111111111111"')
    expect(markup).toContain('Rename')
    expect(markup).toContain('Delete')
    expect(markup).not.toContain('employee-1')
    expect(markup).not.toContain('analysis_spec')
  })
})
