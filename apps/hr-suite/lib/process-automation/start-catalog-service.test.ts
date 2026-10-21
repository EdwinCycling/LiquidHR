import { describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'
import { listStartableProcesses } from './start-catalog-service'

const processId = '00000000-0000-4000-8000-000000000001'

describe('listStartableProcesses', () => {
  it('calls the permission-filtered server catalog with the active tenant and HR group', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        processDefinitionId: processId,
        title: { nl: 'Opleidingsaanvraag', en: 'Training request' },
        description: { nl: 'Vraag een opleiding aan.', en: 'Request training.' },
        steps: [{ title: { nl: 'Manager beoordeelt', en: 'Manager reviews' }, responsibleRole: { nl: 'Manager', en: 'Manager' }, isStart: true }],
        routes: [{ fromTitle: { nl: 'Manager beoordeelt', en: 'Manager reviews' }, label: { nl: 'Goedkeuren', en: 'Approve' }, toTitle: { nl: 'HR verwerkt', en: 'HR processes' } }],
      }],
      error: null,
    })
    const context: AuthContext = {
      tenantId: 'tenant-1', hrGroupId: 'group-1', administrationId: null, userId: 'user-1', employeeId: 'employee-1', activeRoles: ['EMPLOYEE'], permissions: ['self:process-instance:start'],
    }

    const result = await listStartableProcesses({ supabase: { rpc } as never, context })

    expect(rpc).toHaveBeenCalledWith('get_process_startable_catalog', {
      requested_tenant_id: 'tenant-1',
      requested_hr_group_id: 'group-1',
    })
    expect(result).toHaveLength(1)
    expect(result[0]?.title.nl).toBe('Opleidingsaanvraag')
    expect(result[0]?.routes[0]?.label.en).toBe('Approve')
  })

  it('fails closed when the server projection is malformed', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ processDefinitionId: processId, processKey: 'internal-value' }], error: null })
    const context: AuthContext = {
      tenantId: 'tenant-1', hrGroupId: 'group-1', administrationId: null, userId: 'user-1', employeeId: 'employee-1', activeRoles: ['EMPLOYEE'], permissions: ['self:process-instance:start'],
    }

    await expect(listStartableProcesses({ supabase: { rpc } as never, context })).rejects.toMatchObject({ code: 'PROCESS_START_CATALOG_INVALID', status: 500 })
  })
})
