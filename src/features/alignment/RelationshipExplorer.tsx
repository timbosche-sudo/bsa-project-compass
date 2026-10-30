import { Background, Controls, Handle, MiniMap, Position, ReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ArrowUpRight, X } from 'lucide-react'
import { memo, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useProject } from '@/app/project'
import { Badge, Button, Card, cx, Segmented, Select } from '@/components/ui'
import { NODE_TYPE_LABELS, RELATIONSHIP_LABELS } from '@/domain/labels'
import { buildGraph, focusSet, GRAPH_COLUMNS, nodePath, type Graph, type GraphNode } from '@/domain/traceability'
import { isActiveFramework } from '@/domain/wording'

const COL_W = 270
const ROW_H = 66
const NODE_W = 220

type FlowData = { g: GraphNode; dim: boolean; selected: boolean }

const TYPE_ACCENT: Record<string, string> = {
  source: 'border-l-ink-2',
  statement: 'border-l-faint',
  theme: 'border-l-info',
  principle: 'border-l-accent',
  driver: 'border-l-ok',
  decision: 'border-l-warn',
}

const CompassNode = memo(function CompassNode({ data }: NodeProps<Node<FlowData>>) {
  const g = data.g
  return (
    <div
      className={cx(
        'rounded-md border border-l-4 bg-surface px-2.5 py-1.5 shadow-card transition-opacity',
        TYPE_ACCENT[g.ref.type],
        g.flags.orphan ? 'border-dashed border-danger/70' : g.flags.unsupported ? 'border-warn' : 'border-line',
        data.selected && 'ring-2 ring-accent',
        data.dim && 'opacity-20',
      )}
      style={{ width: NODE_W }}
    >
      <Handle type="target" position={Position.Left} className="!size-1.5 !border-0 !bg-line-strong" />
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[10px] text-muted">{g.code}</span>
        {g.flags.critical && <span className="size-1.5 rounded-full bg-danger" title="Critical / non-negotiable" />}
        {g.flags.orphan && <span className="text-[9.5px] font-semibold text-danger uppercase">orphan</span>}
        {g.flags.unsupported && <span className="text-[9.5px] font-semibold text-warn uppercase">unsupported</span>}
      </div>
      <div className="line-clamp-2 text-[11.5px] leading-snug text-ink">{g.title}</div>
      <Handle type="source" position={Position.Right} className="!size-1.5 !border-0 !bg-line-strong" />
    </div>
  )
})

const ColumnLabel = memo(function ColumnLabel({ data }: NodeProps<Node<{ label: string }>>) {
  return <div className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase" style={{ width: NODE_W }}>{data.label}</div>
})

const nodeTypes = { compass: CompassNode, column: ColumnLabel }

/** Column layout with two barycentre passes to reduce crossings. */
function layout(graph: Graph, visibleCols: number[]): Map<string, { x: number; y: number }> {
  const byCol = new Map<number, GraphNode[]>()
  graph.nodes.forEach((n) => {
    if (!visibleCols.includes(n.column)) return
    byCol.set(n.column, [...(byCol.get(n.column) ?? []), n])
  })
  const pos = new Map<string, { x: number; y: number }>()
  const place = () => {
    visibleCols.forEach((col, ci) => {
      const nodes = byCol.get(col) ?? []
      nodes.forEach((n, i) => pos.set(n.key, { x: ci * COL_W, y: i * ROW_H }))
    })
  }
  place()
  for (let pass = 0; pass < 2; pass++) {
    visibleCols.forEach((col) => {
      const nodes = byCol.get(col) ?? []
      const score = (n: GraphNode) => {
        const ys = graph.edges.filter((e) => e.to === n.key || e.from === n.key).map((e) => pos.get(e.to === n.key ? e.from : e.to)?.y).filter((y): y is number => y !== undefined)
        return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : Number.MAX_SAFE_INTEGER
      }
      const scores = new Map(nodes.map((n) => [n.key, score(n)]))
      nodes.sort((a, b) => scores.get(a.key)! - scores.get(b.key)!)
      byCol.set(col, nodes)
    })
    place()
  }
  return pos
}

export function RelationshipExplorer() {
  const { data } = useProject()
  const [view, setView] = useState<'graph' | 'list'>('graph')
  const [includeProposed, setIncludeProposed] = useState(false)
  const [showSources, setShowSources] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [principleFocus, setPrincipleFocus] = useState('')

  const graph = useMemo(() => buildGraph(data, { includeProposed }), [data, includeProposed])
  const visibleCols = useMemo(() => GRAPH_COLUMNS.map((_, i) => i).filter((i) => showSources || i !== 0), [showSources])
  const focusKey = selected ?? (principleFocus ? `principle:${principleFocus}` : null)
  const focus = useMemo(() => (focusKey ? focusSet(graph, focusKey) : null), [graph, focusKey])
  const positions = useMemo(() => layout(graph, visibleCols), [graph, visibleCols])

  const topY = Math.min(0, ...[...positions.values()].map((p) => p.y))
  const labels: Node[] = visibleCols.map((c, i) => ({ id: `col-${c}`, type: 'column', position: { x: i * COL_W, y: topY - 44 }, data: { label: `${NODE_TYPE_LABELS[GRAPH_COLUMNS[c]]}s` }, draggable: false, selectable: false, focusable: false }))
  const nodes: Node[] = [...labels, ...graph.nodes
    .filter((n) => positions.has(n.key))
    .map((n) => ({
      id: n.key,
      type: 'compass',
      position: positions.get(n.key)!,
      data: { g: n, dim: !!focus && !focus.has(n.key), selected: n.key === focusKey },
      draggable: false,
      ariaLabel: `${NODE_TYPE_LABELS[n.ref.type]} ${n.code}: ${n.title}`,
    } as Node<FlowData>))]
  const edges: Edge[] = graph.edges
    .filter((e) => positions.has(e.from) && positions.has(e.to))
    .map((e) => {
      const lit = !focus || (focus.has(e.from) && focus.has(e.to))
      return {
        id: e.key,
        source: e.from,
        target: e.to,
        animated: e.status === 'proposed',
        style: {
          stroke: e.type === 'conflicts_with' ? 'var(--c-risk)' : lit && focus ? 'var(--c-accent)' : 'var(--c-line-strong)',
          strokeDasharray: e.status === 'proposed' || e.type === 'conflicts_with' ? '4 3' : undefined,
          opacity: lit ? 1 : 0.12,
          strokeWidth: lit && focus ? 1.6 : 1,
        },
      }
    })
  const sel = focusKey ? graph.nodes.find((n) => n.key === focusKey) : null

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-3">
        <Segmented
          label="Explorer view"
          value={view}
          onChange={setView}
          options={[
            { value: 'graph', label: 'Graph' },
            { value: 'list', label: 'Accessible list' },
          ]}
        />
        <Select
          aria-label="Focus on a principle"
          className="w-auto max-w-[240px]"
          value={principleFocus}
          onChange={(e) => {
            setPrincipleFocus(e.target.value)
            setSelected(null)
          }}
          options={[{ value: '', label: 'Focus: whole project' }, ...data.principles.filter((p) => isActiveFramework(p.status)).map((p) => ({ value: p.id, label: `Focus: ${p.code} ${p.title}` }))]}
        />
        <label className="flex items-center gap-2 text-[12.5px] text-ink-2">
          <input type="checkbox" className="accent-[var(--c-accent)]" checked={includeProposed} onChange={(e) => setIncludeProposed(e.target.checked)} /> Include proposed links
        </label>
        <label className="flex items-center gap-2 text-[12.5px] text-ink-2">
          <input type="checkbox" className="accent-[var(--c-accent)]" checked={showSources} onChange={(e) => setShowSources(e.target.checked)} /> Show sources
        </label>
        {focusKey && (
          <Button size="sm" variant="ghost" icon={<X className="size-3.5" />} onClick={() => { setSelected(null); setPrincipleFocus('') }}>
            Clear focus
          </Button>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2 text-[11.5px] text-muted">
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm border border-dashed border-danger" /> Orphaned</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm border border-warn" /> Unsupported</span>
          <span className="flex items-center gap-1"><span className="inline-block w-4 border-t border-dashed border-risk" /> Conflict</span>
        </div>
      </div>
      {view === 'graph' ? (
        <div className="relative">
          <div className="h-[68vh] min-h-[480px]" data-testid="relationship-graph">
            <ReactFlow
              key={visibleCols.join(',')}
              onInit={(inst) => {
                const width = (document.querySelector('[data-testid="relationship-graph"]') as HTMLElement | null)?.clientWidth ?? 1000
                const zoom = Math.min(1, Math.max(0.5, (width - 32) / (visibleCols.length * COL_W)))
                inst.setViewport({ x: 16, y: -(topY - 44) * zoom + 16, zoom })
              }}
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              minZoom={0.15}
              maxZoom={2}
              nodesConnectable={false}
              onNodeClick={(_, n) => n.type === 'compass' && setSelected((s) => (s === n.id ? null : n.id))}
              onPaneClick={() => setSelected(null)}
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={24} size={1} color="var(--c-line)" />
              <Controls showInteractive={false} />
              <MiniMap pannable zoomable nodeColor="var(--c-line-strong)" maskColor="rgb(0 0 0 / 0.05)" />
            </ReactFlow>
          </div>
          {sel && (
            <aside className="absolute top-12 right-3 z-10 w-[300px] rounded-lg border border-line bg-raised p-4 shadow-pop" aria-label="Selected node">
              <div className="flex items-center justify-between">
                <Badge tone="outline">{NODE_TYPE_LABELS[sel.ref.type]}</Badge>
                <button aria-label="Close" className="text-muted hover:text-ink" onClick={() => setSelected(null)}>
                  <X className="size-4" />
                </button>
              </div>
              <div className="mt-2 font-mono text-[11px] text-muted">{sel.code}</div>
              <p className="mt-0.5 line-clamp-5 text-[13.5px] font-medium text-ink">{sel.title}</p>
              <p className="mt-2 text-[12px] text-muted">{(focus?.size ?? 1) - 1} connected items upstream and downstream are highlighted.</p>
              <Link to={nodePath(data.project.id, sel.ref)} className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-accent-strong hover:underline">
                Open <ArrowUpRight className="size-3.5" />
              </Link>
            </aside>
          )}
        </div>
      ) : (
        <ListView graph={graph} focus={focus} />
      )}
    </Card>
  )
}

function ListView({ graph, focus }: { graph: Graph; focus: Set<string> | null }) {
  const { data } = useProject()
  const byKey = new Map(graph.nodes.map((n) => [n.key, n]))
  const nodes = graph.nodes.filter((n) => !focus || focus.has(n.key)).sort((a, b) => a.column - b.column)
  return (
    <div className="max-h-[70vh] overflow-auto scroll-thin">
      <table className="table-base min-w-[880px]">
        <caption className="sr-only">Relationships by node: upstream items on the left of the chain and downstream items on the right.</caption>
        <thead>
          <tr>
            <th>Item</th>
            <th>Upstream (supported by)</th>
            <th>Downstream (supports)</th>
            <th>Flags</th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((n) => {
            const up = graph.edges.filter((e) => e.to === n.key).map((e) => ({ e, n: byKey.get(e.from)! }))
            const down = graph.edges.filter((e) => e.from === n.key).map((e) => ({ e, n: byKey.get(e.to)! }))
            const cell = (xs: typeof up) =>
              xs.length === 0 ? (
                <span className="text-faint">—</span>
              ) : (
                <ul className="space-y-0.5">
                  {xs.map(({ e, n: o }) => (
                    <li key={e.key}>
                      <span className="text-muted">{e.type === 'contains' ? 'contains' : RELATIONSHIP_LABELS[e.type]}</span>{' '}
                      <Link className="hover:underline" to={nodePath(data.project.id, o.ref)}>
                        <span className="font-mono text-[11px]">{o.code}</span> {o.title.slice(0, 60)}
                      </Link>
                      {e.status === 'proposed' && <Badge tone="ai" className="ml-1">proposed</Badge>}
                    </li>
                  ))}
                </ul>
              )
            return (
              <tr key={n.key}>
                <td>
                  <div className="text-[11px] text-muted">{NODE_TYPE_LABELS[n.ref.type]}</div>
                  <Link className="font-medium hover:underline" to={nodePath(data.project.id, n.ref)}>
                    <span className="font-mono text-[11px] text-muted">{n.code}</span> {n.title.slice(0, 90)}
                  </Link>
                </td>
                <td>{cell(up)}</td>
                <td>{cell(down)}</td>
                <td className="space-x-1">
                  {n.flags.orphan && <Badge tone="danger">Orphaned</Badge>}
                  {n.flags.unsupported && <Badge tone="warn">Unsupported</Badge>}
                  {n.flags.critical && <Badge tone="danger">Critical</Badge>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
