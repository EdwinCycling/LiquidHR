'use client'

import { useEffect, useMemo } from 'react'
import { LocateFixed, Minus, Plus } from 'lucide-react'
import { Background, BackgroundVariant, Panel, ReactFlow, useReactFlow, type Edge } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { OrganizationChartGraph } from '@/lib/organization-chart/types'
import { organizationChartNodeTypes, type OrganizationChartLabels, type OrganizationFlowNode } from './organization-chart-nodes'
import { layoutOrganizationChart } from './organization-chart-layout'

interface OrganizationChartCanvasProps {
  graph: OrganizationChartGraph
  labels: OrganizationChartLabels & {
    canvasLabel: string
    zoomIn: string
    zoomOut: string
    fitView: string
  }
}

function layoutGraph(graph: OrganizationChartGraph, labels: OrganizationChartLabels): OrganizationFlowNode[] {
  const positions = layoutOrganizationChart(graph)

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
  return graph.edges.map((edge) => {
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      pathOptions: { borderRadius: 8, offset: 24 },
      style: {
        stroke: 'var(--accent-foreground)',
        strokeWidth: 2.5,
        opacity: edge.matchState === 'dimmed' ? 0.2 : 1,
      },
    }
  })
}

function AtlasControls({ labels }: { labels: OrganizationChartCanvasProps['labels'] }) {
  const flow = useReactFlow()
  const buttonClass = 'grid size-10 place-items-center border-b border-border bg-surface text-foreground outline-none transition-colors last:border-b-0 hover:bg-muted focus-visible:bg-accent focus-visible:text-accent-foreground'
  const motionDuration = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180
  return (
    <Panel className="!m-4 overflow-hidden rounded-[var(--radius-control)] border bg-surface" position="bottom-right">
      <div aria-label={labels.canvasLabel} role="toolbar">
        <button aria-label={labels.zoomIn} className={buttonClass} onClick={() => flow.zoomIn({ duration: motionDuration() })} title={labels.zoomIn} type="button"><Plus aria-hidden="true" size={17} /></button>
        <button aria-label={labels.zoomOut} className={buttonClass} onClick={() => flow.zoomOut({ duration: motionDuration() })} title={labels.zoomOut} type="button"><Minus aria-hidden="true" size={17} /></button>
        <button aria-label={labels.fitView} className={buttonClass} onClick={() => flow.fitView({ padding: 0.16, maxZoom: 1, duration: motionDuration() })} title={labels.fitView} type="button"><LocateFixed aria-hidden="true" size={17} /></button>
      </div>
    </Panel>
  )
}

function FitToContent({ layoutKey }: { layoutKey: string }) {
  const flow = useReactFlow()

  useEffect(() => {
    const timeouts = [120, 500, 1200, 2200].map((delay) => window.setTimeout(() => {
      flow.fitView({ padding: 0.16, maxZoom: 1, duration: 0 })
    }, delay))
    return () => timeouts.forEach((timeout) => window.clearTimeout(timeout))
  }, [flow, layoutKey])

  return null
}

export function OrganizationChartCanvas({ graph, labels }: OrganizationChartCanvasProps) {
  const nodes = useMemo(() => layoutGraph(graph, labels), [graph, labels])
  const edges = useMemo(() => flowEdges(graph), [graph])
  const layoutKey = `${graph.metadata.view}:${graph.metadata.asOfDate}:${nodes.length}`

  return (
    <div aria-label={labels.canvasLabel} className="relative hidden h-[44rem] overflow-hidden rounded-[var(--radius-surface)] border bg-surface-raised md:block" role="region">
      <ReactFlow
        key={layoutKey}
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
        onInit={(instance) => { window.setTimeout(() => instance.fitView({ padding: 0.16, maxZoom: 1, duration: 0 }), 500) }}
        panOnDrag
        proOptions={{ hideAttribution: true }}
        zoomOnDoubleClick={false}
      >
        <Background color="var(--border)" gap={28} size={1} variant={BackgroundVariant.Dots} />
        <FitToContent layoutKey={layoutKey} />
        <AtlasControls labels={labels} />
      </ReactFlow>
    </div>
  )
}
