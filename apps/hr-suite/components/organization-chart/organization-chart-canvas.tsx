'use client'

import { useMemo } from 'react'
import { LocateFixed, Minus, Plus, Route } from 'lucide-react'
import { Background, BackgroundVariant, MarkerType, Panel, ReactFlow, useReactFlow, type Edge } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { OrganizationChartGraph, OrganizationChartNode } from '@/lib/organization-chart/types'
import { organizationChartNodeTypes, type OrganizationChartLabels, type OrganizationFlowNode } from './organization-chart-nodes'

interface OrganizationChartCanvasProps {
  graph: OrganizationChartGraph
  labels: OrganizationChartLabels & {
    canvasLabel: string
    zoomIn: string
    zoomOut: string
    fitView: string
    legendRoute: string
    legendMatch: string
    legendContext: string
  }
}

const DEPARTMENT_WIDTH = 264
const EMPLOYEE_WIDTH = 224
const EMPLOYEE_HEIGHT = 132
const EMPLOYEE_GAP = 20
const MAX_EMPLOYEE_COLUMNS = 4
const BRANCH_GAP = 72
const CARD_TO_CLUSTER_GAP = 190
const CLUSTER_TO_CHILDREN_GAP = 120
const DEPARTMENT_ROW_GAP = 240

interface SubtreeSize { width: number; height: number }

function layoutGraph(graph: OrganizationChartGraph, labels: OrganizationChartLabels): OrganizationFlowNode[] {
  const children = new Map<string, string[]>()
  const targets = new Set<string>()
  graph.edges.forEach((edge) => {
    children.set(edge.source, [...(children.get(edge.source) ?? []), edge.target])
    targets.add(edge.target)
  })
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  const sizeById = new Map<string, SubtreeSize>()
  const positions = new Map<string, { x: number; y: number }>()

  function splitChildren(nodeId: string): { employees: OrganizationChartNode[]; branches: OrganizationChartNode[] } {
    const childNodes = (children.get(nodeId) ?? []).flatMap((id) => {
      const node = nodeById.get(id)
      return node ? [node] : []
    })
    return {
      employees: childNodes.filter((node) => node.type === 'employee'),
      branches: childNodes.filter((node) => node.type !== 'employee'),
    }
  }

  function measure(nodeId: string, trail: ReadonlySet<string>): SubtreeSize {
    const cached = sizeById.get(nodeId)
    if (cached) return cached
    const node = nodeById.get(nodeId)
    if (!node || node.type === 'employee' || trail.has(nodeId)) return { width: EMPLOYEE_WIDTH, height: EMPLOYEE_HEIGHT }

    const nextTrail = new Set(trail).add(nodeId)
    const { employees, branches } = splitChildren(nodeId)
    const columns = Math.min(MAX_EMPLOYEE_COLUMNS, Math.max(1, employees.length))
    const rows = employees.length > 0 ? Math.ceil(employees.length / columns) : 0
    const clusterWidth = employees.length > 0 ? columns * EMPLOYEE_WIDTH + (columns - 1) * EMPLOYEE_GAP : 0
    const branchSizes = branches.map((branch) => measure(branch.id, nextTrail))
    const branchesWidth = branchSizes.reduce((sum, size) => sum + size.width, 0) + Math.max(0, branchSizes.length - 1) * BRANCH_GAP
    const branchesHeight = branchSizes.length > 0 ? Math.max(...branchSizes.map((size) => size.height)) : 0
    const clusterHeight = rows * EMPLOYEE_HEIGHT
    const ownHeight = DEPARTMENT_ROW_GAP + clusterHeight + (rows > 0 && branches.length > 0 ? CLUSTER_TO_CHILDREN_GAP : 0)
    const size = {
      width: Math.max(DEPARTMENT_WIDTH, clusterWidth, branchesWidth),
      height: Math.max(DEPARTMENT_ROW_GAP, ownHeight + branchesHeight),
    }
    sizeById.set(nodeId, size)
    return size
  }

  function place(nodeId: string, left: number, top: number, trail: ReadonlySet<string>): void {
    const node = nodeById.get(nodeId)
    if (!node || trail.has(nodeId)) return
    if (node.type === 'employee') {
      positions.set(node.id, { x: left, y: top })
      return
    }

    const size = measure(nodeId, trail)
    const center = left + size.width / 2
    positions.set(node.id, { x: center - DEPARTMENT_WIDTH / 2, y: top })
    const nextTrail = new Set(trail).add(nodeId)
    const { employees, branches } = splitChildren(nodeId)
    const columns = Math.min(MAX_EMPLOYEE_COLUMNS, Math.max(1, employees.length))
    const rows = employees.length > 0 ? Math.ceil(employees.length / columns) : 0

    if (employees.length > 0) {
      const clusterWidth = columns * EMPLOYEE_WIDTH + (columns - 1) * EMPLOYEE_GAP
      const clusterLeft = center - clusterWidth / 2
      employees.forEach((employee, index) => {
        const row = Math.floor(index / columns)
        const itemsInRow = Math.min(columns, employees.length - row * columns)
        const rowWidth = itemsInRow * EMPLOYEE_WIDTH + (itemsInRow - 1) * EMPLOYEE_GAP
        const rowLeft = center - rowWidth / 2
        const column = index % columns
        positions.set(employee.id, {
          x: row === rows - 1 ? rowLeft + column * (EMPLOYEE_WIDTH + EMPLOYEE_GAP) : clusterLeft + column * (EMPLOYEE_WIDTH + EMPLOYEE_GAP),
          y: top + CARD_TO_CLUSTER_GAP + row * EMPLOYEE_HEIGHT,
        })
      })
    }

    if (branches.length > 0) {
      const sizes = branches.map((branch) => measure(branch.id, nextTrail))
      const totalWidth = sizes.reduce((sum, branchSize) => sum + branchSize.width, 0) + (branches.length - 1) * BRANCH_GAP
      let branchLeft = center - totalWidth / 2
      const branchTop = top + DEPARTMENT_ROW_GAP + rows * EMPLOYEE_HEIGHT + (rows > 0 ? CLUSTER_TO_CHILDREN_GAP : 0)
      branches.forEach((branch, index) => {
        place(branch.id, branchLeft, branchTop, nextTrail)
        branchLeft += sizes[index].width + BRANCH_GAP
      })
    }
  }

  const roots = graph.nodes.filter((node) => !targets.has(node.id))
  let rootLeft = 0
  roots.forEach((root) => {
    const size = measure(root.id, new Set())
    place(root.id, rootLeft, 0, new Set())
    rootLeft += size.width + BRANCH_GAP
  })
  graph.nodes.forEach((node) => {
    if (!positions.has(node.id)) {
      positions.set(node.id, { x: rootLeft, y: 0 })
      rootLeft += node.type === 'employee' ? EMPLOYEE_WIDTH + EMPLOYEE_GAP : DEPARTMENT_WIDTH + BRANCH_GAP
    }
  })

  return graph.nodes.map((chartNode) => ({
    id: chartNode.id,
    type: chartNode.type,
    position: positions.get(chartNode.id) ?? { x: 0, y: 0 },
    data: { chartNode, labels },
    draggable: false,
    selectable: false,
  }))
}

function flowEdges(graph: OrganizationChartGraph): Edge[] {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  return graph.edges.map((edge) => {
    const onRoute = edge.matchState === 'context'
    const memberEdge = nodeById.get(edge.target)?.type === 'employee'
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      pathOptions: { offset: memberEdge ? 18 : 30, stepPosition: 0.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: onRoute ? 'var(--accent-foreground)' : 'var(--border)' },
      style: {
        stroke: onRoute ? 'var(--accent-foreground)' : memberEdge ? 'var(--accent-foreground)' : 'var(--border)',
        strokeWidth: onRoute ? 3 : memberEdge ? 1.8 : 2.2,
        strokeDasharray: memberEdge ? '5 4' : undefined,
        opacity: edge.matchState === 'dimmed' ? 0.2 : 1,
        filter: onRoute ? 'drop-shadow(0 0 5px var(--accent-foreground))' : undefined,
      },
    }
  })
}

function AtlasControls({ labels }: { labels: OrganizationChartCanvasProps['labels'] }) {
  const flow = useReactFlow()
  const buttonClass = 'grid size-10 place-items-center border-b border-border bg-surface text-foreground outline-none transition-colors last:border-b-0 hover:bg-muted focus-visible:bg-accent focus-visible:text-accent-foreground'
  const motionDuration = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180
  return (
    <Panel className="!m-4 overflow-hidden rounded-xl border bg-surface shadow-md" position="bottom-right">
      <div aria-label={labels.canvasLabel} role="toolbar">
        <button aria-label={labels.zoomIn} className={buttonClass} onClick={() => flow.zoomIn({ duration: motionDuration() })} title={labels.zoomIn} type="button"><Plus aria-hidden="true" size={17} /></button>
        <button aria-label={labels.zoomOut} className={buttonClass} onClick={() => flow.zoomOut({ duration: motionDuration() })} title={labels.zoomOut} type="button"><Minus aria-hidden="true" size={17} /></button>
        <button aria-label={labels.fitView} className={buttonClass} onClick={() => flow.fitView({ padding: 0.16, maxZoom: 1, duration: motionDuration() })} title={labels.fitView} type="button"><LocateFixed aria-hidden="true" size={17} /></button>
      </div>
    </Panel>
  )
}

export function OrganizationChartCanvas({ graph, labels }: OrganizationChartCanvasProps) {
  const nodes = useMemo(() => layoutGraph(graph, labels), [graph, labels])
  const edges = useMemo(() => flowEdges(graph), [graph])

  return (
    <div aria-label={labels.canvasLabel} className="relative hidden h-[44rem] overflow-hidden rounded-3xl border bg-surface-raised shadow-[inset_0_1px_0_var(--surface)] md:block" role="region">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,var(--accent),transparent_62%)] opacity-75" />
      <ReactFlow
        edges={edges}
        elementsSelectable={false}
        fitView
        fitViewOptions={{ padding: 0.16, maxZoom: 1 }}
        maxZoom={1.45}
        minZoom={0.12}
        nodeTypes={organizationChartNodeTypes}
        nodes={nodes}
        nodesConnectable={false}
        nodesDraggable={false}
        nodesFocusable
        panOnDrag
        proOptions={{ hideAttribution: true }}
        zoomOnDoubleClick={false}
      >
        <Background color="var(--border)" gap={28} size={1} variant={BackgroundVariant.Dots} />
        <Panel className="!m-4 rounded-2xl border bg-surface/95 px-3.5 py-3 shadow-sm" position="top-left">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground"><Route aria-hidden="true" className="text-accent-foreground" size={15} />{labels.legendRoute}</div>
          <div className="mt-2 flex items-center gap-3 text-[0.65rem] font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-2 rounded-full bg-focus shadow-[0_0_0_3px_var(--accent)]" />{labels.legendMatch}</span>
            <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-0.5 w-5 bg-accent-foreground shadow-[0_0_5px_var(--accent-foreground)]" />{labels.legendContext}</span>
          </div>
        </Panel>
        <AtlasControls labels={labels} />
      </ReactFlow>
    </div>
  )
}
