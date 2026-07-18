'use client'

import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const colors = ['hsl(var(--primary))', 'hsl(var(--accent-foreground))', 'hsl(var(--success))', 'hsl(var(--warning))']
export function MiniChart({ kind, values }: { kind: 'bar' | 'donut'; values: Array<{ name: string; value: number }> }) {
  return <div className="h-32 w-full" aria-hidden="true"><ResponsiveContainer height="100%" width="100%">{kind === 'donut' ? <PieChart><Pie data={values} dataKey="value" innerRadius={34} outerRadius={52} paddingAngle={3}>{values.map((entry, index) => <Cell fill={colors[index % colors.length]} key={entry.name} />)}</Pie><Tooltip /></PieChart> : <BarChart data={values} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}><XAxis axisLine={false} dataKey="name" tick={{ fontSize: 10 }} tickLine={false} /><YAxis axisLine={false} tick={{ fontSize: 10 }} tickLine={false} /><Tooltip /><Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} /></BarChart>}</ResponsiveContainer></div>
}
