import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { WvpDossier } from './wvp-dossier'
import { wvpLabelKeys } from './wvp-labels'
import type { WvpCase } from '@/lib/absence/wvp/service'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
const id='11111111-1111-4111-8111-111111111111'
const labels=Object.fromEntries(wvpLabelKeys.map(key=>[key,`label-${key}`]))
const dossier: WvpCase={ id,employeeId:id,employmentId:id,administrationId:id,name:'Test Medewerker',status:'ACTIVE',firstAbsenceOn:'2026-01-01',clockStartOn:'2026-01-01',pendingConfirmation:false,processInstanceId:id,closedAt:null,canManage:true,canConfirm:true,isSelf:false,currentMilestone:'WVP_WEEK_6',tasks:[{id,code:'WVP_WEEK_6',dueOn:'2026-02-12',status:'OPEN',completedAt:null}],events:[],capacity:[],spells:[{startedOn:'2026-01-01',recoveredOn:null}] }
function render(overrides: Partial<WvpCase>={}) { return renderToStaticMarkup(<WvpDossier dossier={{...dossier,...overrides}} labels={labels} today="2026-10-26" locale="nl" />) }
it('biedt HR mijlpaalbevestiging en werkafspraak met echte endpointacties',()=> {
  const html=render(); expect(html).toContain('label-complete'); expect(html).toContain('label-recordAgreement'); expect(html).not.toContain('<textarea')
})
it('biedt de manager afspraken maar geen HR-mijlpaalafronding',()=> {
  const html=render({canConfirm:false}); expect(html).toContain('label-recordAgreement'); expect(html).not.toContain('label-complete')
})
it('onderscheidt een ontbrekende WVP-documentkoppeling van een ontbrekend document',()=> {
  const html=render()
  expect(html).toContain('label-dossierDocuments')
  expect(html).toContain('label-dossierDocumentRelationshipNote')
  expect(html).toContain('label-dossierDocumentNotLinked')
  expect(html).toContain('/employees/' + id + '?tab=documents')
})
it('biedt de employee uitsluitend eigen kennisname',()=> {
  const event={id,type:'AGREEMENT',occurredOn:'2026-01-02',createdAt:'2026-01-02T12:00:00Z',actorUserId:id,taskId:null,agreement:'ADAPTED_HOURS',reviewOn:'2026-01-20',agreementId:null}
  const html=render({canManage:false,canConfirm:false,isSelf:true,events:[event]}); expect(html).toContain('label-acknowledge'); expect(html).not.toContain('label-recordAgreement'); expect(html).not.toContain('label-complete')
})
it('toont geen kennisname van anderen of al bevestigde afspraken',()=> {
  const event={id,type:'AGREEMENT',occurredOn:'2026-01-02',createdAt:'2026-01-02T12:00:00Z',actorUserId:id,taskId:null,agreement:'ADAPTED_HOURS',reviewOn:'2026-01-20',agreementId:null}
  expect(render({events:[event]})).not.toContain('label-acknowledge')
  expect(render({canManage:false,isSelf:true,events:[event,{...event,id:'22222222-2222-4222-8222-222222222222',type:'ACKNOWLEDGED',agreementId:id}]})).not.toContain('label-acknowledge')
})
