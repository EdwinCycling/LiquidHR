import type { OrganizationChartGraph, OrganizationChartNode } from '@/lib/organization-chart/types'

export interface OrganizationChartPosition { x: number; y: number }

interface LayoutSize { width: number; height: number }
interface LayoutItem { id: string; size: LayoutSize }
interface LayoutRow { items: LayoutItem[]; width: number; height: number }

export type OrganizationChartEdgeRoute =
  | { kind: 'child-row'; branchY: number }
  | { kind: 'overflow-row'; branchY: number; laneX: number }

export interface OrganizationChartLayout {
  positions: ReadonlyMap<string, OrganizationChartPosition>
  edgeRoutes: ReadonlyMap<string, OrganizationChartEdgeRoute>
}

export function buildOrganizationChartEdgePath(
  route: OrganizationChartEdgeRoute,
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): string {
  return route.kind === 'overflow-row'
    ? `M ${sourceX} ${sourceY} H ${route.laneX} V ${route.branchY} H ${targetX} V ${targetY}`
    : `M ${sourceX} ${sourceY} V ${route.branchY} H ${targetX} V ${targetY}`
}

const PRIMARY_WIDTH = 256
const PRIMARY_HEIGHT = 188
const ADMINISTRATION_HEIGHT = 144
const EMPLOYEE_WIDTH = 224
const EMPLOYEE_HEIGHT = 138
const ITEM_GAP = 28
const ROW_GAP = 40
const NODE_TO_CHILD_GAP = 68
const ROOT_GAP = 96
const ROUTE_GUTTER = 28
const MAX_COLUMNS = 4
const MAX_ROOT_COLUMNS = 4

function nodeSize(node: OrganizationChartNode): LayoutSize {
  if (node.type === 'administration') return { width: PRIMARY_WIDTH, height: ADMINISTRATION_HEIGHT }
  if (node.type === 'employee') return { width: EMPLOYEE_WIDTH, height: EMPLOYEE_HEIGHT }
  return { width: PRIMARY_WIDTH, height: PRIMARY_HEIGHT }
}

function rowFor(items: LayoutItem[]): LayoutRow {
  return {
    items,
    width: items.reduce((sum, item) => sum + item.size.width, 0) + Math.max(0, items.length - 1) * ITEM_GAP,
    height: Math.max(...items.map((item) => item.size.height)),
  }
}

function rowsFor(items: LayoutItem[], columns: number): LayoutRow[] {
  const rows: LayoutRow[] = []
  for (let index = 0; index < items.length; index += columns) {
    rows.push(rowFor(items.slice(index, index + columns)))
  }
  return rows
}

function gridSize(rows: readonly LayoutRow[]): LayoutSize {
  return {
    width: Math.max(0, ...rows.map((row) => row.width)),
    height: rows.reduce((sum, row) => sum + row.height, 0) + Math.max(0, rows.length - 1) * ROW_GAP,
  }
}

function childOrder(nodeById: ReadonlyMap<string, OrganizationChartNode>, ids: readonly string[]): string[] {
  return [...ids].sort((leftId, rightId) => {
    const left = nodeById.get(leftId)
    const right = nodeById.get(rightId)
    const leftRank = left?.type === 'employee' ? 0 : 1
    const rightRank = right?.type === 'employee' ? 0 : 1
    return leftRank - rightRank || leftId.localeCompare(rightId)
  })
}

/**
 * Lays out both the department hierarchy and the manager-to-employee tree.
 * Every child subtree is treated as a grid item so manager chains cannot
 * collapse into one horizontal row or overlap their following siblings.
 */
export function layoutOrganizationChart(graph: OrganizationChartGraph): OrganizationChartLayout {
  const childrenById = new Map<string, string[]>()
  const targets = new Set<string>()
  graph.edges.forEach((edge) => {
    childrenById.set(edge.source, [...(childrenById.get(edge.source) ?? []), edge.target])
    targets.add(edge.target)
  })
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  const sizeById = new Map<string, LayoutSize>()
  const positions = new Map<string, OrganizationChartPosition>()

  function measure(nodeId: string, trail: ReadonlySet<string>): LayoutSize {
    const cached = sizeById.get(nodeId)
    if (cached) return cached
    const node = nodeById.get(nodeId)
    if (!node || trail.has(nodeId)) return { width: EMPLOYEE_WIDTH, height: EMPLOYEE_HEIGHT }

    const ownSize = nodeSize(node)
    const nextTrail = new Set(trail).add(nodeId)
    const childItems = childOrder(nodeById, childrenById.get(nodeId) ?? []).flatMap((childId) => {
      const child = nodeById.get(childId)
      return child ? [{ id: childId, size: measure(childId, nextTrail) }] : []
    })
    const columns = Math.min(MAX_COLUMNS, Math.max(1, childItems.length))
    const childrenSize = gridSize(rowsFor(childItems, columns))
    const routeGutter = childItems.length > MAX_COLUMNS ? ROUTE_GUTTER * 2 : 0
    const size = childItems.length === 0
      ? ownSize
      : {
          width: Math.max(ownSize.width, childrenSize.width) + routeGutter,
          height: ownSize.height + NODE_TO_CHILD_GAP + childrenSize.height,
        }
    sizeById.set(nodeId, size)
    return size
  }

  function place(nodeId: string, left: number, top: number, trail: ReadonlySet<string>): void {
    const node = nodeById.get(nodeId)
    if (!node || trail.has(nodeId)) return

    const subtreeSize = measure(nodeId, trail)
    const ownSize = nodeSize(node)
    const center = left + subtreeSize.width / 2
    positions.set(nodeId, { x: center - ownSize.width / 2, y: top })

    const nextTrail = new Set(trail).add(nodeId)
    const childItems = childOrder(nodeById, childrenById.get(nodeId) ?? []).flatMap((childId) => {
      const child = nodeById.get(childId)
      return child ? [{ id: childId, size: measure(childId, nextTrail) }] : []
    })
    if (childItems.length === 0) return

    const columns = Math.min(MAX_COLUMNS, Math.max(1, childItems.length))
    const rows = rowsFor(childItems, columns)
    let rowTop = top + ownSize.height + NODE_TO_CHILD_GAP
    rows.forEach((row) => {
      let itemLeft = center - row.width / 2
      row.items.forEach((item) => {
        place(item.id, itemLeft, rowTop, nextTrail)
        itemLeft += item.size.width + ITEM_GAP
      })
      rowTop += row.height + ROW_GAP
    })
  }

  const roots = graph.nodes.filter((node) => !targets.has(node.id))
  const rootItems = roots.map((root) => ({ id: root.id, size: measure(root.id, new Set()) }))
  const rootRows = rowsFor(rootItems, MAX_ROOT_COLUMNS)
  let rootTop = 0
  rootRows.forEach((row) => {
    let rootLeft = 0
    row.items.forEach((item) => {
      place(item.id, rootLeft, rootTop, new Set())
      rootLeft += item.size.width + ROOT_GAP
    })
    rootTop += row.height + ROOT_GAP
  })

  graph.nodes.forEach((node) => {
    if (positions.has(node.id)) return
    positions.set(node.id, { x: 0, y: rootTop })
    rootTop += nodeSize(node).height + ROOT_GAP
  })

  const edgeRoutes = new Map<string, OrganizationChartEdgeRoute>()
  childrenById.forEach((childIds, sourceId) => {
    const source = nodeById.get(sourceId)
    const sourcePosition = positions.get(sourceId)
    if (!source || !sourcePosition) return

    const orderedChildren = childOrder(nodeById, childIds)
    const rowYById = new Map(orderedChildren.map((childId) => [childId, positions.get(childId)?.y ?? Number.MAX_SAFE_INTEGER]))
    const rowTops = [...new Set(rowYById.values())].sort((left, right) => left - right)
    const ownSize = nodeSize(source)
    const childItems = orderedChildren.flatMap((childId) => {
      const child = nodeById.get(childId)
      return child ? [{ id: childId, size: sizeById.get(childId) ?? nodeSize(child) }] : []
    })
    const columns = Math.min(MAX_COLUMNS, Math.max(1, childItems.length))
    const childGridWidth = gridSize(rowsFor(childItems, columns)).width
    const laneX = sourcePosition.x + ownSize.width / 2 + childGridWidth / 2 + ROUTE_GUTTER / 2

    graph.edges.filter((edge) => edge.source === sourceId).forEach((edge) => {
      const targetY = rowYById.get(edge.target) ?? Number.MAX_SAFE_INTEGER
      const rowIndex = rowTops.indexOf(targetY)
      if (rowIndex <= 0) {
        edgeRoutes.set(edge.id, {
          kind: 'child-row',
          branchY: sourcePosition.y + ownSize.height + NODE_TO_CHILD_GAP / 2,
        })
        return
      }

      edgeRoutes.set(edge.id, {
        kind: 'overflow-row',
        branchY: targetY - ROW_GAP / 2,
        laneX,
      })
    })
  })

  return { positions, edgeRoutes }
}
