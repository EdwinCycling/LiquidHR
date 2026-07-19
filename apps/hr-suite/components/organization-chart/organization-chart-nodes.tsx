'use client'

import Image from 'next/image'
import Link from 'next/link'
import { AlertTriangle, Building2, Crown, Network, UsersRound } from 'lucide-react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import type { OrganizationChartNode } from '@/lib/organization-chart/types'

export interface OrganizationChartLabels {
  employees: string
  groupedEmployees: string
  rootEmployees: string
  manager: string
  managerInherited: string
  managerNone: string
  managerAmbiguous: string
  jobUnknown: string
  moreBadges: string
  openEmployee: string
  administrationNode: string
  departmentNode: string
  groupNode: string
  employeeNode: string
}

export interface OrganizationChartNodeData extends Record<string, unknown> {
  chartNode: OrganizationChartNode
  labels: OrganizationChartLabels
}

export type OrganizationFlowNode = Node<OrganizationChartNodeData, OrganizationChartNode['type']>

function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (placeholder, key: string) => {
    const value = values[key]
    return value === undefined ? placeholder : String(value)
  })
}

function stateClasses(state: OrganizationChartNode['matchState']): string {
  if (state === 'match') return 'ring-2 ring-focus opacity-100 shadow-[0_0_0_6px_var(--accent),0_18px_40px_-20px_var(--accent-foreground)]'
  if (state === 'context') return 'ring-1 ring-accent-foreground/40 opacity-100 shadow-[0_0_0_4px_var(--accent)]'
  if (state === 'dimmed') return 'opacity-25 saturate-50'
  return 'opacity-100'
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
}

function AdministrationCard({ node, labels }: { node: Extract<OrganizationChartNode, { type: 'administration' }>; labels: OrganizationChartLabels }) {
  return (
    <article aria-label={`${labels.administrationNode}: ${node.name}`} className={`w-full rounded-2xl bg-primary px-5 py-4 text-primary-foreground shadow-lg transition-[opacity,box-shadow] md:w-64 ${stateClasses(node.matchState)}`}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-foreground/10">
          <Network aria-hidden="true" size={19} />
        </span>
        <div className="min-w-0">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-primary-foreground/70">{labels.administrationNode}</p>
          <h2 className="mt-1 truncate text-base font-semibold">{node.name}</h2>
          <p className="mt-1 text-xs text-primary-foreground/70">{node.code}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 border-t border-primary-foreground/15 pt-3 text-xs font-medium text-primary-foreground/80">
        <UsersRound aria-hidden="true" size={14} />
        {interpolate(labels.employees, { count: node.employeeCount })}
      </div>
    </article>
  )
}

function DepartmentCard({ node, labels }: { node: Extract<OrganizationChartNode, { type: 'department' }>; labels: OrganizationChartLabels }) {
  const manager = node.manager
  const managerText = manager.status === 'none'
    ? labels.managerNone
    : manager.status === 'ambiguous'
      ? interpolate(labels.managerAmbiguous, { count: manager.count })
      : manager.employeeName

  return (
    <article aria-label={`${labels.departmentNode}: ${node.name}`} className={`w-full overflow-hidden rounded-2xl border bg-surface shadow-sm transition-[opacity,box-shadow] md:w-64 ${stateClasses(node.matchState)}`}>
      <div className="h-1 bg-accent-foreground" aria-hidden="true" />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
            <Building2 aria-hidden="true" size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{node.code}</p>
            <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-foreground">{node.name}</h3>
          </div>
          <span className="rounded-full bg-muted px-2 py-1 text-[0.65rem] font-semibold text-muted-foreground">{node.employeeCount}</span>
        </div>
        <div className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 ${manager.status === 'ambiguous' ? 'bg-warning-surface text-warning' : 'bg-surface-raised text-muted-foreground'}`}>
          {manager.status === 'ambiguous' ? <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" size={14} /> : <Crown aria-hidden="true" className="mt-0.5 shrink-0" size={14} />}
          <div className="min-w-0">
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em]">{manager.status === 'inherited' ? labels.managerInherited : labels.manager}</p>
            <p className="mt-0.5 line-clamp-2 text-xs font-medium">{managerText}</p>
          </div>
        </div>
      </div>
    </article>
  )
}

function GroupCard({ node, labels }: { node: Extract<OrganizationChartNode, { type: 'group' }>; labels: OrganizationChartLabels }) {
  const icon = node.groupKind === 'manager-root'
    ? <UsersRound aria-hidden="true" size={17} />
    : node.groupKind === 'star-level'
      ? <Crown aria-hidden="true" size={17} />
      : <Building2 aria-hidden="true" size={17} />

  return (
    <article aria-label={`${labels.groupNode}: ${node.title}`} className={`w-full overflow-hidden rounded-2xl border bg-surface shadow-sm transition-[opacity,box-shadow] md:w-64 ${stateClasses(node.matchState)}`}>
      <div className="h-1 bg-accent-foreground" aria-hidden="true" />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
            {icon}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{labels.groupNode}</p>
            <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-foreground">{node.title}</h3>
            {node.subtitle ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{node.subtitle}</p> : null}
          </div>
          <span className="rounded-full bg-muted px-2 py-1 text-[0.65rem] font-semibold text-muted-foreground">{node.employeeCount}</span>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-surface-raised px-3 py-2.5 text-muted-foreground">
          <UsersRound aria-hidden="true" className="mt-0.5 shrink-0" size={14} />
          <div className="min-w-0">
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em]">
              {node.groupKind === 'manager-root' ? labels.rootEmployees : labels.groupedEmployees}
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs font-medium">{interpolate(labels.employees, { count: node.employeeCount })}</p>
          </div>
        </div>
      </div>
    </article>
  )
}

function EmployeeCard({ node, labels }: { node: Extract<OrganizationChartNode, { type: 'employee' }>; labels: OrganizationChartLabels }) {
  const visibleBadges = node.badges.slice(0, 2)
  const extraBadges = node.badges.length - visibleBadges.length

  return (
    <Link aria-label={interpolate(labels.openEmployee, { name: node.name })} href={`/employees/${node.employeeId}`} className={`block w-full rounded-2xl border bg-surface p-3.5 shadow-sm outline-none transition-[opacity,box-shadow,transform] hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-focus md:w-56 ${stateClasses(node.matchState)}`}>
      <div className="flex items-center gap-3">
        <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted text-xs font-bold text-foreground">
          {node.avatarUrl ? <Image alt="" className="object-cover" fill sizes="40px" src={node.avatarUrl} /> : initials(node.name)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-foreground">{node.name}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{node.jobTitle ?? labels.jobUnknown}</span>
        </span>
      </div>
      {node.badges.length > 0 ? (
        <span className="mt-3 flex flex-wrap gap-1.5">
          {visibleBadges.map((badge) => <span className="rounded-full bg-accent px-2 py-1 text-[0.62rem] font-semibold text-accent-foreground" key={badge.code}>{badge.name}</span>)}
          {extraBadges > 0 ? <span className="rounded-full bg-muted px-2 py-1 text-[0.62rem] font-semibold text-muted-foreground">{interpolate(labels.moreBadges, { count: extraBadges })}</span> : null}
        </span>
      ) : null}
    </Link>
  )
}

export function OrganizationChartNodeCard({ node, labels }: { node: OrganizationChartNode; labels: OrganizationChartLabels }) {
  if (node.type === 'administration') return <AdministrationCard labels={labels} node={node} />
  if (node.type === 'department') return <DepartmentCard labels={labels} node={node} />
  if (node.type === 'group') return <GroupCard labels={labels} node={node} />
  return <EmployeeCard labels={labels} node={node} />
}

function FlowNode({ data }: NodeProps<OrganizationFlowNode>) {
  return (
    <>
      <Handle className="!size-2 !border-surface !bg-accent-foreground" isConnectable={false} position={Position.Top} type="target" />
      <OrganizationChartNodeCard labels={data.labels} node={data.chartNode} />
      {data.chartNode.type !== 'employee' ? <Handle className="!size-2 !border-surface !bg-accent-foreground" isConnectable={false} position={Position.Bottom} type="source" /> : null}
    </>
  )
}

export const organizationChartNodeTypes = {
  administration: FlowNode,
  department: FlowNode,
  group: FlowNode,
  employee: FlowNode,
}
