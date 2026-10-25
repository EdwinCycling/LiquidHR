import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthorizationError } from '@/lib/auth/permissions'
import { GET, POST } from '@/app/api/settings/work-calendars/route'
import { POST as previewPOST } from '@/app/api/settings/work-calendars/preview/route'

const mocks = vi.hoisted(()=>({ requirePermission:vi.fn(),rpc:vi.fn() }))
vi.mock('@/lib/auth/permissions',async original=>({ ...await original<typeof import('@/lib/auth/permissions')>(),requirePermission:mocks.requirePermission }))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({rpc:mocks.rpc})}))
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const body={administrationId:id(3),expectedRevision:0,config:{name:'Jupiter',weekdays:[1,2,3,4,5],validFrom:'2026-01-01',validUntil:'2027-12-31',holidayIds:[],exceptions:[],holidaySelectionConfirmed:true,reason:'Publicatie'}}
const request=(value:unknown)=>new Request('http://localhost/api/settings/work-calendars',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)})
describe('work calendar HTTP and service boundaries',()=>{
  beforeEach(()=>{
    vi.clearAllMocks()
    mocks.requirePermission.mockResolvedValue({tenantId:id(1),hrGroupId:id(2),administrationId:id(3),userId:id(4),employeeId:id(5),activeRoles:['HR_ADMIN'],permissions:['process-definition:write']})
    mocks.rpc.mockResolvedValue({data:{calendars:[],effectiveVersionId:null},error:null})
  })
  it('derives tenant and HR group from the authenticated context and uses the current administration',async()=>{
    expect((await POST(request(body))).status).toBe(201)
    expect(mocks.requirePermission).toHaveBeenCalledWith('process-definition:write')
    expect(mocks.rpc).toHaveBeenCalledWith('publish_work_calendar',expect.objectContaining({requested_hr_group_id:id(2),requested_administration_id:id(3),requested_expected_revision:0,requested_config:body.config}))
    expect(mocks.rpc.mock.calls[0][1]).not.toHaveProperty('requested_tenant_id')
  })
  it.each(['Manager','Employee'])('denies %s before any database call',async()=>{
    mocks.requirePermission.mockRejectedValue(new AuthorizationError('Geen beheerrechten'))
    expect((await GET()).status).toBe(403)
    expect((await POST(request(body))).status).toBe(403)
    expect((await previewPOST(request({versionId:id(9),date:'2026-10-24',time:'09:00',days:2}))).status).toBe(403)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('rejects a foreign administration and injected tenant scope',async()=>{
    expect((await POST(request({...body,administrationId:id(99)}))).status).toBe(403)
    expect((await POST(request({...body,tenantId:id(99)}))).status).toBe(400)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('refuses invalid dates, empty workweeks, duplicates and unreviewed holidays',async()=>{
    for(const patch of [{weekdays:[]},{weekdays:[1,1]},{holidaySelectionConfirmed:false},{validFrom:'2026-02-30'},{validUntil:'2025-01-01'},{exceptions:[{date:'2026-01-02',isWorkday:false,label:'A'},{date:'2026-01-02',isWorkday:true,label:'B'}]}]) {
      expect((await POST(request({...body,config:{...body.config,...patch}}))).status).toBe(400)
    }
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('uses the canonical server calculation for previews',async()=>{
    mocks.rpc.mockResolvedValue({data:{deadlineAt:'2026-10-27T08:00:00Z',calendarVersionId:id(9),revision:1,timeZone:'Europe/Amsterdam',countedDates:['2026-10-26','2026-10-27'],skippedDates:['2026-10-25']},error:null})
    const response=await previewPOST(request({versionId:id(9),date:'2026-10-24',time:'09:00',days:2}))
    expect(response.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith('preview_work_calendar_deadline',{requested_version_id:id(9),requested_local_start:'2026-10-24T09:00:00',requested_days:2})
  })
  it.each([['SLA_WORKDAY_CALENDAR_OUT_OF_RANGE','P0001',409],['WORK_CALENDAR_STALE','40001',409],['missing function','PGRST202',503],['unexpected database failure','XX000',500]])('reports %s without converting it to a successful response',async(message,code,status)=>{
    mocks.rpc.mockResolvedValue({data:null,error:{message,code}})
    expect((await GET()).status).toBe(status)
  })
})
