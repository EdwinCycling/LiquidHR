import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthorizationError } from '@/lib/auth/permissions'
import { copySystemComponent, getComponentLibrary } from './component-library'

const { access, repository, list, fork, mapper } = vi.hoisted(() => ({
  access: vi.fn(), repository: vi.fn(), list: vi.fn(), fork: vi.fn(), mapper: vi.fn(),
}))
vi.mock('./component-library-access', () => ({ requireComponentLibraryAccess: access }))
vi.mock('./component-draft-repository', () => ({ createComponentDraftRepository: repository }))
vi.mock('./component-draft-service', () => ({
  createComponentDraftService: () => ({ list, forkSystemComponent: fork }), toDraftCatalogEntry: mapper,
}))
const validated = {
  scope: { tenantId: 'tenant', hrGroupId: 'group', administrationId: 'admin' },
  administration: { id: 'lab-admin' }, actorUserId: 'actor', canCopy: true,
}
describe('authenticated component library adapter', () => {
  beforeEach(() => { vi.clearAllMocks(); access.mockResolvedValue(validated) })
  it('lists real packages and only the authenticated administration drafts', async () => {
    list.mockResolvedValue([{ id: 'test-draft' }])
    mapper.mockReturnValue({ key: 'draft::test-draft' })
    const view = await getComponentLibrary()
    expect(view.components).toHaveLength(25)
    expect(list).toHaveBeenCalledWith(validated.scope, 'lab-admin')
    expect(view.components.at(-1)?.key).toBe('draft::test-draft')
  })
  it('re-authorizes every copy and supplies no client-owned scope', async () => {
    fork.mockResolvedValue({ id: 'test' })
    await copySystemComponent('exact-catalog-key')
    expect(access).toHaveBeenCalledWith(true)
    expect(fork).toHaveBeenCalledWith(validated.scope, 'lab-admin', 'actor', 'exact-catalog-key')
  })
  it('does not create a service-role database client before access is granted', async () => {
    access.mockRejectedValue(new AuthorizationError('denied'))
    await expect(getComponentLibrary()).rejects.toBeInstanceOf(AuthorizationError)
    await expect(copySystemComponent('SYSTEM')).rejects.toBeInstanceOf(AuthorizationError)
    expect(repository).not.toHaveBeenCalled()
    expect(fork).not.toHaveBeenCalled()
    expect(list).not.toHaveBeenCalled()
  })
})
