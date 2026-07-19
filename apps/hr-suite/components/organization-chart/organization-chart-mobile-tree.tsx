import { ChevronRight } from 'lucide-react'
import type { OrganizationChartGraph, OrganizationChartNode } from '@/lib/organization-chart/types'
import { OrganizationChartNodeCard, type OrganizationChartLabels } from './organization-chart-nodes'

interface OrganizationChartMobileTreeProps {
  graph: OrganizationChartGraph
  labels: OrganizationChartLabels & { mobileTreeLabel: string; expandBranch: string }
}

function interpolate(template: string, value: string): string {
  return template.replace('{name}', value)
}

function TreeBranch({ node, childrenById, nodeById, labels, depth }: {
  node: OrganizationChartNode
  childrenById: ReadonlyMap<string, string[]>
  nodeById: ReadonlyMap<string, OrganizationChartNode>
  labels: OrganizationChartMobileTreeProps['labels']
  depth: number
}) {
  const children = (childrenById.get(node.id) ?? []).flatMap((id) => {
    const child = nodeById.get(id)
    return child ? [child] : []
  })

  if (children.length === 0) {
    return <li className="min-w-0"><OrganizationChartNodeCard labels={labels} node={node} /></li>
  }

  const name = node.type === 'group' ? node.title : node.name
  return (
    <li className="min-w-0">
      <details className="group min-w-0" open={depth < 2}>
        <summary aria-label={interpolate(labels.expandBranch, name)} className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-focus [&::-webkit-details-marker]:hidden">
          <ChevronRight aria-hidden="true" className="shrink-0 text-muted-foreground transition-transform group-open:rotate-90" size={18} />
          <div className="min-w-0 flex-1"><OrganizationChartNodeCard labels={labels} node={node} /></div>
        </summary>
        <ul className={depth < 2 ? 'ml-2 mt-3 space-y-3 border-l pl-5' : 'mt-3 space-y-3 border-l border-dashed pl-0'}>
          {children.map((child) => <TreeBranch childrenById={childrenById} depth={depth + 1} key={child.id} labels={labels} node={child} nodeById={nodeById} />)}
        </ul>
      </details>
    </li>
  )
}

export function OrganizationChartMobileTree({ graph, labels }: OrganizationChartMobileTreeProps) {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  const childrenById = new Map<string, string[]>()
  const targets = new Set<string>()
  graph.edges.forEach((edge) => {
    childrenById.set(edge.source, [...(childrenById.get(edge.source) ?? []), edge.target])
    targets.add(edge.target)
  })
  const roots = graph.nodes.filter((node) => !targets.has(node.id))

  return (
    <nav aria-label={labels.mobileTreeLabel} className="overflow-hidden rounded-3xl border bg-surface p-4 md:hidden">
      <ul className="min-w-0 space-y-4">
        {roots.map((root) => <TreeBranch childrenById={childrenById} depth={0} key={root.id} labels={labels} node={root} nodeById={nodeById} />)}
      </ul>
    </nav>
  )
}
