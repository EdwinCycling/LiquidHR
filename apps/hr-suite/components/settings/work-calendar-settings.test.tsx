// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import messages from '@/messages/nl/settings.json'
import type { WorkCalendarModel } from '@/lib/work-calendars/schemas'
import { WorkCalendarSettings } from './work-calendar-settings'

Object.defineProperty(globalThis,'IS_REACT_ACT_ENVIRONMENT',{configurable:true,value:true})
const l={...messages.workCalendars,days:Object.values(messages.workCalendars.days)}
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const calendar: WorkCalendarModel={effectiveVersionId:id(2),calendars:[{id:id(1),administrationId:null,revision:1,version:{id:id(2),name:'Planeten',time_zone:'Europe/Amsterdam',weekdays:[1,2,3,4,5],valid_from:'2026-01-01',valid_until:'2027-12-31',created_at:'2026-01-01T00:00:00Z',reason:'Publicatie'},exceptions:[],history:[{revision:1,created_at:'2026-01-01T00:00:00Z',reason:'Publicatie'}]}]}
let root:Root|undefined,container:HTMLDivElement
const fetchMock=vi.fn()
function mount(initial:WorkCalendarModel={calendars:[],effectiveVersionId:null}) {
  container=document.createElement('div');document.body.append(container);root=createRoot(container)
  act(()=>root?.render(createElement(WorkCalendarSettings,{initial,groupName:'Planeten',administrationId:id(3),administrationName:'Jupiter BV',timeZone:'Europe/Amsterdam',labels:l,locale:'nl'})))
}
function button(text:string,scope:ParentNode=document) {
  const result=[...scope.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===text)
  if(!result)throw Error(`Missing button ${text}`)
  return result
}
function field(label:string) {
  const result=document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)
  if(!result)throw Error(`Missing field ${label}`)
  return result
}
function input(label:string,value:string) {
  act(()=>{const f=field(label);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set?.call(f,value);f.dispatchEvent(new Event('input',{bubbles:true}));f.dispatchEvent(new Event('change',{bubbles:true}))})
}
function checkbox(text:string) {
  const label=[...document.querySelectorAll('label')].find(node=>node.textContent?.includes(text))
  const result=label?.querySelector<HTMLInputElement>('input[type=checkbox]')
  if(!result)throw Error(`Missing checkbox ${text}`)
  return result
}
async function open() {await act(async()=>{button(l.configure).click();await new Promise(resolve=>setTimeout(resolve,0))})}
beforeEach(()=>{
  fetchMock.mockReset();fetchMock.mockResolvedValue(Response.json({data:[{id:id(7),date:'2026-04-03',label:'Goede Vrijdag'}]}));vi.stubGlobal('fetch',fetchMock)
})
afterEach(()=>{act(()=>root?.unmount());container?.remove();root=undefined;vi.unstubAllGlobals()})

describe('work calendar administration UX',()=>{
  it('shows the real scope, inheritance and publication impact before configuring',()=>{
    mount()
    expect(container.textContent).toContain('HR-groepsstandaard — Planeten')
    expect(container.textContent).toContain('Administratieafwijking — Jupiter BV')
    expect(container.textContent).toContain(l.changePolicy)
    expect(container.textContent).toContain(l.previewRequiresCalendar)
  })
  it('requires an explicit holiday choice and review before publication',async()=>{
    mount();await open()
    expect(checkbox('Maandag').checked).toBe(true)
    expect(checkbox('Zaterdag').checked).toBe(false)
    expect(checkbox('Goede Vrijdag').checked).toBe(false)
    expect(button(l.publish).disabled).toBe(true)
    act(()=>checkbox('Goede Vrijdag').click())
    expect(checkbox(l.holidayConfirmed).checked).toBe(false)
    act(()=>checkbox(l.holidayConfirmed).click())
    input(l.reason,'Vrije dagen expliciet vastgesteld')
    fetchMock.mockResolvedValueOnce(Response.json({data:calendar}))
    const form=field(l.reason).closest('form')
    await act(async()=>{form?.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await new Promise(resolve=>setTimeout(resolve,0))})
    const request=fetchMock.mock.calls.find(call=>call[0]==='/api/settings/work-calendars')
    expect(request).toBeDefined()
    expect(JSON.parse(request?.[1].body)).toMatchObject({administrationId:null,expectedRevision:0,config:{holidayIds:[id(7)],holidaySelectionConfirmed:true,reason:'Vrije dagen expliciet vastgesteld'}})
    expect(container.textContent).toContain(l.published)
  })
  it('keeps publication disabled when the holiday register could not be loaded',async()=>{
    fetchMock.mockResolvedValue(Response.json({code:'WORK_CALENDAR_UNAVAILABLE'},{status:503}))
    mount();await open()
    expect(button(l.publish).disabled).toBe(true)
    expect(document.querySelector('[role=alert]')?.textContent).toContain(l.errors.WORK_CALENDAR_UNAVAILABLE)
    expect(fetchMock.mock.calls.every(call=>!call[1]?.method)).toBe(true)
  })
  it('displays the canonical server preview, including skipped dates and version',async()=>{
    mount(calendar)
    input(l.previewDate,'2026-10-24')
    fetchMock.mockResolvedValue(Response.json({data:{deadlineAt:'2026-10-27T08:00:00Z',calendarVersionId:id(2),revision:1,timeZone:'Europe/Amsterdam',countedDates:['2026-10-26','2026-10-27'],skippedDates:['2026-10-25']}}))
    await act(async()=>{button(l.preview).closest('form')?.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await new Promise(resolve=>setTimeout(resolve,0))})
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({date:'2026-10-24',time:'09:00',days:2,versionId:id(2)})
    expect(container.textContent).toContain('27 oktober 2026')
    expect(container.textContent).toContain('Europe/Amsterdam')
    expect(container.textContent).toContain(l.countedDays)
    expect(container.textContent).toContain(l.skippedDays)
  })
})
