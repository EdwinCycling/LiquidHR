import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { WvpDossier } from './wvp-dossier'
import { wvpLabelKeys } from './wvp-labels'
import type { WvpCase, WvpDocumentLink } from '@/lib/absence/wvp/service'
import type { EmployeeDocumentLinkOption } from '@/lib/documents/document-service'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
const id='11111111-1111-4111-8111-111111111111'
const labels=Object.fromEntries(wvpLabelKeys.map(key=>[key,`label-${key}`]))
const dossier: WvpCase={ id,employeeId:id,employmentId:id,administrationId:id,name:'Test Medewerker',status:'ACTIVE',firstAbsenceOn:'2026-01-01',clockStartOn:'2026-01-01',pendingConfirmation:false,processInstanceId:id,closedAt:null,canManage:true,canConfirm:true,isSelf:false,currentMilestone:'WVP_WEEK_6',tasks:[{id,code:'WVP_WEEK_6',dueOn:'2026-02-12',status:'OPEN',completedAt:null}],events:[],capacity:[],spells:[{startedOn:'2026-01-01',recoveredOn:null}] }
const linkedDocumentId='22222222-2222-4222-8222-222222222222'
const documentLink: WvpDocumentLink={id:'33333333-3333-4333-8333-333333333333',taskId:id,documentId:linkedDocumentId,createdAt:'2026-01-03T12:00:00Z'}
const documentOption: EmployeeDocumentLinkOption={id:linkedDocumentId,title:'Werkafspraak',createdAt:'2026-01-02T12:00:00Z'}
function render(overrides: Partial<WvpCase>={}, options: {
  processStatus?: string | null
  documentLinks?: WvpDocumentLink[]
  documentOptions?: EmployeeDocumentLinkOption[]
  canManageDocumentLinks?: boolean
  linksUnavailable?: boolean
  documentReadUnavailable?: boolean
}={}) {
  return renderToStaticMarkup(<WvpDossier dossier={{...dossier,...overrides}} documentLinks={options.documentLinks ?? []} documentOptions={options.documentOptions ?? []} canManageDocumentLinks={options.canManageDocumentLinks ?? true} linksUnavailable={options.linksUnavailable ?? false} documentReadUnavailable={options.documentReadUnavailable ?? false} labels={labels} today="2026-10-26" locale="nl" processStatus={options.processStatus ?? null} />)
}
it('biedt HR mijlpaalbevestiging en werkafspraak met echte endpointacties',()=> {
  const html=render(); expect(html).toContain('label-complete'); expect(html).toContain('label-recordAgreement'); expect(html).toContain('label-nextAction'); expect(html).toContain('label-OVERDUE'); expect(html).not.toContain('<textarea')
})
it('toont PMUX-processtatus wanneer de bestaande projection actor-read toestaat',()=> {
  const html=render({}, {processStatus:'RUNNING'})
  expect(html).toContain('label-processStatus')
  expect(html).toContain('label-processRunning')
})
it('biedt de manager afspraken maar geen HR-mijlpaalafronding',()=> {
  const html=render({canConfirm:false}); expect(html).toContain('label-recordAgreement'); expect(html).not.toContain('label-complete')
})
it('toont mijlpaalrol, gekoppelde gebeurtenis en de beveiligde medewerkersdocumentroute',()=> {
  const event={id,type:'MILESTONE',occurredOn:'2026-02-10',createdAt:'2026-02-10T12:00:00Z',actorUserId:id,taskId:id,agreement:null,reviewOn:null,agreementId:null}
  const html=render({events:[event]})
  expect(html).toContain('label-dossierReadinessNote')
  expect(html).toContain('label-dossierOwnerPhysician')
  expect(html).toContain('label-dossierReadinessOpen')
  expect(html).toContain('label-dossierEvent')
  expect(html).toContain('/employees/' + id + '?tab=documents')
})
it('markeert een voltooide mijlpaal zonder gekoppelde gebeurtenis als ontbrekende registratie',()=> {
  const task={...dossier.tasks[0],status:'COMPLETED',completedAt:'2026-02-10T12:00:00Z'}
  const html=render({canConfirm:false,currentMilestone:null,tasks:[task]})
  expect(html).toContain('label-dossierReadinessMissingEvent')
})
it('onderscheidt een ontbrekende WVP-documentkoppeling van een ontbrekend document',()=> {
  const html=render({}, {linksUnavailable:false,documentReadUnavailable:false})
  expect(html).toContain('label-noDocumentLink')
  expect(html).toContain('label-documentLinkHelp')
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
it('toont gekoppelde documenten per mijlpaal en schermt beheer af voor Employee',()=> {
  const employeeHtml=render({canManage:false,canConfirm:false,isSelf:true},{documentLinks:[documentLink],documentOptions:[documentOption],canManageDocumentLinks:false})
  expect(employeeHtml).toContain('Werkafspraak')
  expect(employeeHtml).not.toContain('label-removeDocumentLink')
  const managerHtml=render({}, {documentLinks:[documentLink],documentOptions:[documentOption],canManageDocumentLinks:true})
  expect(managerHtml).toContain('label-removeDocumentLink')
})
it('biedt geen ontkoppeling wanneer de geautoriseerde documentreferentie niet leesbaar is',()=> {
  const html=render({}, {documentLinks:[documentLink],documentOptions:[],canManageDocumentLinks:true})
  expect(html).toContain('label-documentUnavailable')
  expect(html).not.toContain('label-removeDocumentLink')
})
