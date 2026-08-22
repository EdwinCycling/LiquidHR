// @vitest-environment happy-dom

import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthorizationManager, type AuthorizationLabels } from './authorization-manager'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }))

vi.mock('next/navigation', () => ({
  usePathname: () => '/authorization',
  useRouter: () => ({ refresh: refreshMock, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams('tab=overview'),
}))

const labels: AuthorizationLabels = {
  roles: 'Rollen', newRole: 'Nieuwe tenantrol', roleCode: 'Rolcode', roleName: 'Rolnaam', roleDescription: 'Omschrijving', createRole: 'Rol aanmaken', roleCreateDescription: 'Rol aanmaken', close: 'Sluiten', cancel: 'Annuleren', discardTitle: 'Wijzigingen verwerpen?', discardDescription: 'Rolgegevens gaan verloren.', discardConfirm: 'Wijzigingen verwerpen', discardCancel: 'Verder bewerken',
  permissionDiscardTitle: 'Rechtenwijzigingen verwerpen?', permissionDiscardDescription: 'Niet-opgeslagen rechtenwijzigingen gaan verloren.', permissionDiscardConfirm: 'Wijzigingen verwerpen', permissionDiscardCancel: 'Verder bekijken',
  systemRole: 'Systeemrol', tenantRole: 'Tenantrol', roleOrganizationScoped: 'Afdelingsgebonden', permissions: 'Functiepunten', selectRole: 'Selecteer een rol', savePermissions: 'Rechten opslaan', placements: 'Plaatsingen', managementAssignments: 'Managementtoewijzingen', employee: 'Medewerker', department: 'Afdeling', role: 'Rol', jobTitle: 'Functie', effectiveFrom: 'Geldig vanaf', addPlacement: 'Plaatsing toevoegen', addManagement: 'Rolhouder toevoegen', saved: 'Wijziging opgeslagen.', failed: 'De wijziging kon niet worden opgeslagen.',
  tabPermissions: 'Rechten beheren', tabOverview: 'Grafisch overzicht', tabAssignments: 'Toewijzingen', roleSearch: 'Zoek rol', permissionSearch: 'Zoek functiepunt', totalRoles: 'Rollen', activeTenantRoles: 'Actieve tenantrollen', assignedPermissions: 'Toegekende rechten', coveredCategories: 'Gebieden', selectedCount: 'functiepunten toegekend', selectAll: 'Alles selecteren', clearAll: 'Alles wissen', unsavedChanges: 'niet-opgeslagen wijzigingen', resetChanges: 'Herstellen', readOnlyRole: 'Alleen bekijken', inactiveRole: 'Inactief', activeRole: 'Actief', coverage: 'Dekking', coverageExplanation: 'Toegekende rechten in dit gebied.', overviewTitle: 'Autorisatielandschap', overviewSubtitle: 'Bekijk de dekking.', scopeNoticeTitle: 'Recht én scope bepalen de toegang', scopeNotice: 'Scope blijft vereist.', assignmentTitle: 'Toewijzingen', assignmentSubtitle: 'Beheer toewijzingen.', noSearchResults: 'Geen resultaten', permissionCode: 'Functiepuntcode', selfAuthorizationLockout: 'Eigen toegang blijft behouden.',
}

const role = {
  code: 'R2-AUTH-TEST', created_at: '2026-01-01T00:00:00Z', deleted_at: null, deputy_role_id: null, description: 'Coverage acceptance role', id: 'role-test', is_active: true, is_organization_scoped: false, is_system: false, name: 'R2 Authorization Test', tenant_id: 'tenant-test', updated_at: '2026-01-01T00:00:00Z',
}

const permissions = [
  { category: 'Medewerkers', code: 'employee:read', created_at: '2026-01-01T00:00:00Z', description: 'Read employees', id: 'permission-read', name: 'Medewerkers lezen' },
  { category: 'Medewerkers', code: 'employee:write', created_at: '2026-01-01T00:00:00Z', description: 'Write employees', id: 'permission-write', name: 'Medewerkers wijzigen' },
]

const rolePermissions = [{ created_at: '2026-01-01T00:00:00Z', management_role_id: role.id, permission_id: permissions[0].id }]

function mount(): { host: HTMLDivElement; root: Root; opener: HTMLButtonElement } {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  act(() => { root.render(createElement(AuthorizationManager, { labels, permissions, rolePermissions, roles: [role] })) })
  const opener = document.querySelector<HTMLButtonElement>('button[aria-label*="R2 Authorization Test"]')
  if (!opener) throw new Error('Coverage opener not found')
  return { host, opener, root }
}

async function settle(): Promise<void> {
  await act(async () => { await Promise.resolve(); await Promise.resolve() })
}

function dialogButton(label: string): HTMLButtonElement {
  const button = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find((candidate) => candidate.textContent?.includes(label) || candidate.getAttribute('aria-label') === label)
  if (!button) throw new Error(`Button not found: ${label}`)
  return button
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('AuthorizationManager coverage dialog', () => {
  it('loads the matrix, saves once with pending state, closes on success, and restores focus', async () => {
    const response = { promise: Promise.resolve(new Response(JSON.stringify({ data: { updated: true } }), { status: 200 })), resolve: () => undefined }
    const fetchMock = vi.fn<typeof fetch>().mockReturnValue(response.promise)
    vi.stubGlobal('fetch', fetchMock)
    const { opener, root } = mount()

    act(() => { opener.focus(); opener.click() })
    await settle()
    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog?.textContent).toContain('employee:read')
    const permissionCheckboxes = dialog?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
    expect(permissionCheckboxes).toHaveLength(2)

    act(() => { permissionCheckboxes?.[1]?.click() })
    const save = dialogButton(labels.savePermissions)
    act(() => { save.click() })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(save.disabled).toBe(true)
    expect(save.getAttribute('aria-busy')).toBe('true')
    act(() => { save.click() })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await settle()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(opener)
    root.unmount()
  })

  it('keeps the dialog open with an error and confirms dirty close', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ error: 'ROLE_PERMISSIONS_WRITE_FAILED' }), { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)
    const { root } = mount()

    const opener = document.querySelector<HTMLButtonElement>('button[aria-label*="R2 Authorization Test"]')
    if (!opener) throw new Error('Coverage opener not found')
    act(() => { opener.click() })
    await settle()
    const permissionCheckboxes = document.querySelectorAll<HTMLInputElement>('[role="dialog"] input[type="checkbox"]')
    act(() => { permissionCheckboxes[1]?.click() })
    act(() => { dialogButton(labels.savePermissions).click() })
    await settle()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(labels.failed)
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()

    act(() => { dialogButton(labels.close).click() })
    await settle()
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(2)
    expect(document.body.textContent).toContain(labels.permissionDiscardTitle)
    act(() => { dialogButton(labels.permissionDiscardCancel).click() })
    await settle()
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1)

    act(() => { dialogButton(labels.close).click() })
    await settle()
    act(() => { dialogButton(labels.permissionDiscardConfirm).click() })
    await settle()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    root.unmount()
  })
})
