import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { StarPerformerWorkspace } from '@/lib/star-performers/service'
import { StarPerformerManager } from './star-performer-manager'
import { StarPerformerTagManager } from './star-performer-tag-manager'

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }))

const tagLabels = {
  activate: 'Activeren',
  cancel: 'Annuleren',
  close: 'Sluiten',
  createTag: 'Tag toevoegen',
  deactivate: 'Deactiveren',
  deactivateConfirm: 'Deactiveren',
  deactivateDescription: 'De tag blijft bewaard.',
  deactivateTitle: 'Cloud tag deactiveren?',
  discardCancel: 'Verder bewerken',
  discardConfirm: 'Wijzigingen negeren',
  discardDescription: 'Niet-opgeslagen wijzigingen gaan verloren.',
  discardTitle: 'Wijzigingen negeren?',
  editTag: 'Wijzigen',
  inactive: 'Inactief',
  moreActions: 'Meer acties',
  newTag: 'Nieuwe tag',
  saving: 'Opslaan…',
  tagActive: 'Actief',
  tagEmpty: 'Nog geen tags.',
  tagListTitle: 'Cloud tagcatalogus',
  tagManagerCardTitle: 'Cloud tag toevoegen of wijzigen',
  tagName: 'Tagnaam',
  tagSaved: 'Opgeslagen.',
  tagSaveFailed: 'Opslaan mislukt.',
  tagSearchPlaceholder: 'Zoek op cloud tag',
  updateTag: 'Tag opslaan',
  usageCount: 'Huidig gebruik',
  writeRequired: 'Alleen-lezen toegang.',
}

const managerLabels = {
  all: 'Alle',
  currentContext: 'Huidige context',
  department: 'Afdeling',
  employeeNumber: 'Medewerkernummer',
  emptyDescription: 'Kies een context.',
  emptyTitle: 'Kies een context om te starten',
  filtersTitle: 'Filter en context',
  job: 'Functie',
  jobGroup: 'Functiegroep',
  lastUpdated: 'Laatst bijgewerkt',
  levelJob: 'Functie',
  levelJobGroup: 'Functiegroep',
  minStars: 'Minimaal aantal sterren',
  moreTags: 'Tags sluiten',
  noResults: 'Geen resultaten.',
  noTagsAvailable: 'Geen actieve tags.',
  noTagsSelected: 'Nog geen tags gekoppeld.',
  notRatedYet: 'Nog niet beoordeeld',
  openEmployee: 'Open het profiel.',
  readOnly: 'Alleen lezen',
  saved: 'Opgeslagen.',
  saveFailed: 'Opslaan mislukt.',
  saving: 'Opslaan…',
  search: 'Zoeken',
  searchPlaceholder: 'Zoek op medewerker',
  selectJob: 'Kies een functie',
  selectJobGroup: 'Kies eerst een functiegroep',
  stars: 'Crucialiteit',
  summaryAverage: 'Gemiddelde sterren',
  summaryEmployees: 'Medewerkers in selectie',
  summaryRated: 'Met beoordeling',
  summaryTags: 'Actieve tags',
  tagFilter: 'Filter op tag',
  tags: 'Tags',
  toggleTags: 'Tags wijzigen',
  workEmail: 'Werk e-mail',
}

const workspace: StarPerformerWorkspace = {
  assessments: [{
    criticalityLevel: 5,
    employeeId: '11111111-1111-4111-8111-111111111111',
    id: '33333333-3333-4333-8333-333333333333',
    jobGroupId: null,
    jobId: '22222222-2222-4222-8222-222222222222',
    tagIds: ['44444444-4444-4444-8444-444444444444'],
    updatedAt: '2026-08-22T08:00:00.000Z',
  }],
  employees: [{
    avatarUrl: null,
    birthName: 'Vermeer',
    departmentId: '55555555-5555-4555-8555-555555555555',
    departmentName: 'Operations',
    firstName: 'Anna',
    id: '11111111-1111-4111-8111-111111111111',
    jobGroupId: '66666666-6666-4666-8666-666666666666',
    jobGroupName: 'Service',
    jobId: '22222222-2222-4222-8222-222222222222',
    jobName: 'HR adviseur',
    employeeNumber: 'R3-001',
    workEmail: 'anna@example.invalid',
  }],
  jobGroups: [{ code: 'SERVICE', id: '66666666-6666-4666-8666-666666666666', name: 'Service' }],
  jobs: [{ code: 'HR-ADV', id: '22222222-2222-4222-8222-222222222222', jobGroupId: '66666666-6666-4666-8666-666666666666', name: 'HR adviseur' }],
  tags: [{ id: '44444444-4444-4444-8444-444444444444', isActive: true, name: 'R3-STAR-DEMO', usageCount: 1 }],
}

describe('Roadmap 3 Star Performer Foundation flow', () => {
  it('renders tag management as a list-first collection with Foundation actions', () => {
    const markup = renderToStaticMarkup(<StarPerformerTagManager canWrite initialTags={workspace.tags} labels={tagLabels} />)

    expect(markup).toContain('Zoek op cloud tag')
    expect(markup).toContain('R3-STAR-DEMO')
    expect(markup).toContain('Nieuwe tag')
    expect(markup).toContain('Meer acties')
    expect(markup).toContain('Huidig gebruik: 1')
  })

  it('hides tag mutations for read-only personas', () => {
    const markup = renderToStaticMarkup(<StarPerformerTagManager canWrite={false} initialTags={workspace.tags} labels={tagLabels} />)

    expect(markup).toContain('Alleen-lezen toegang.')
    expect(markup).not.toContain('Nieuwe tag')
    expect(markup).not.toContain('Wijzigen')
    expect(markup).not.toContain('Meer acties')
  })

  it('keeps employee identity, tags and profile clickthrough while hiding write actions', () => {
    const markup = renderToStaticMarkup(<StarPerformerManager canViewEmployees canWrite={false} labels={managerLabels} query={{ level: 'job', q: '', jobId: '22222222-2222-4222-8222-222222222222' }} workspace={workspace} />)

    expect(markup).toContain('Anna Vermeer')
    expect(markup).toContain('R3-STAR-DEMO')
    expect(markup).toContain('href="/employees/11111111-1111-4111-8111-111111111111"')
    expect(markup).toContain('Alleen lezen')
    expect(markup).not.toContain('Tags wijzigen')
  })
})
