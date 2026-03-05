import { useState } from 'react'
import {
    ComposedChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts'
import type { UserMatchSummary } from '../../types/stats'

const WEEK_OPTIONS = [4, 8, 12, 16] as const
type WeekOption = typeof WEEK_OPTIONS[number] | 'all'

interface Props {
    matches: UserMatchSummary[]
}

/** Returns the ISO date string (YYYY-MM-DD) of the Monday that starts the match's week. */
function getWeekStart(dateStr: string): string {
    const d = new Date(dateStr)
    const day = d.getUTCDay() // 0 = Sun, 1 = Mon, …
    const diff = day === 0 ? -6 : 1 - day // shift to Monday
    d.setUTCDate(d.getUTCDate() + diff)
    d.setUTCHours(0, 0, 0, 0)
    return d.toISOString().slice(0, 10)
}

function formatWeekLabel(isoDate: string): string {
    const d = new Date(isoDate + 'T00:00:00Z')
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' })
}

export default function UserWeekTrendChart({ matches }: Props) {
    const [weekLimit, setWeekLimit] = useState<WeekOption>(12)

    if (matches.length === 0) {
        return (
            <div role="img" aria-label="user week trend chart" className="w-full flex items-center justify-center py-12">
                <p className="text-text-muted text-sm">No data yet</p>
            </div>
        )
    }

    // Group matches by ISO week start (Monday)
    const weekMap = new Map<string, UserMatchSummary[]>()
    for (const m of matches) {
        const key = getWeekStart(m.matchDate)
        const group = weekMap.get(key) ?? []
        group.push(m)
        weekMap.set(key, group)
    }

    // Build chart data sorted chronologically, then slice to the chosen window
    const allChartData = Array.from(weekMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, ms]) => {
            const count = ms.length
            const totalPlus = ms.reduce((s, m) => s + m.totalPlus, 0)
            const totalMinus = ms.reduce((s, m) => s + m.totalMinus, 0)
            const totalGoals = ms.reduce((s, m) => s + m.goalCount, 0)
            return {
                label: formatWeekLabel(key),
                matchCount: count,
                'Avg Plus': parseFloat((totalPlus / count).toFixed(1)),
                'Avg Minus': parseFloat((totalMinus / count).toFixed(1)),
                'Avg Goals': parseFloat((totalGoals / count).toFixed(1)),
                _totalPlus: totalPlus,
                _totalMinus: totalMinus,
                _totalGoals: totalGoals,
            }
        })

    const chartData =
        weekLimit === 'all' ? allChartData : allChartData.slice(-weekLimit)

    return (
        <div role="img" aria-label="user week trend chart" className="w-full">
            {/* Week-count selector */}
            <div className="flex items-center gap-1 mb-3 flex-wrap">
                <span className="text-text-muted text-xs mr-1">Show:</span>
                {WEEK_OPTIONS.map((n) => (
                    <button
                        key={n}
                        onClick={() => setWeekLimit(n)}
                        className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${weekLimit === n
                                ? 'bg-primary text-white'
                                : 'bg-surface text-text-muted hover:text-text border border-border'
                            }`}
                    >
                        {n}w
                    </button>
                ))}
                <button
                    onClick={() => setWeekLimit('all')}
                    className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${weekLimit === 'all'
                            ? 'bg-primary text-white'
                            : 'bg-surface text-text-muted hover:text-text border border-border'
                        }`}
                >
                    All
                </button>
            </div>
            <ResponsiveContainer width="100%" height={300}>
                <ComposedChart
                    data={chartData}
                    margin={{ top: 10, right: 20, left: 0, bottom: 40 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                        dataKey="label"
                        tick={{ fill: '#9ca3af', fontSize: 11 }}
                        angle={-35}
                        textAnchor="end"
                        interval={0}
                    />
                    <YAxis
                        allowDecimals
                        tick={{ fill: '#9ca3af', fontSize: 12 }}
                    />
                    <Tooltip
                        content={({ active, payload, label }) => {
                            if (!active || !payload || payload.length === 0) return null
                            const entry = chartData.find((d) => d.label === label)
                            const totals: Record<string, number> = {
                                'Avg Plus': entry?._totalPlus ?? 0,
                                'Avg Minus': entry?._totalMinus ?? 0,
                                'Avg Goals': entry?._totalGoals ?? 0,
                            }
                            return (
                                <div
                                    style={{
                                        backgroundColor: '#1f2937',
                                        border: '1px solid #374151',
                                        color: '#fff',
                                        padding: '10px 14px',
                                        borderRadius: 6,
                                        fontSize: 12,
                                    }}
                                >
                                    <p style={{ marginBottom: 4, fontWeight: 'bold' }}>
                                        Week of {label} —{' '}
                                        {entry?.matchCount} match{entry?.matchCount !== 1 ? 'es' : ''}
                                    </p>
                                    {payload.map((p) => (
                                        <p key={p.name} style={{ color: p.color as string, margin: '2px 0' }}>
                                            {p.name}: {p.value} ({totals[p.name as string]})
                                        </p>
                                    ))}
                                </div>
                            )
                        }}
                    />
                    <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
                    <Bar dataKey="Avg Goals" fill="#3b82f6" opacity={0.7} radius={[3, 3, 0, 0]} />
                    <Line
                        type="monotone"
                        dataKey="Avg Plus"
                        stroke="#22c55e"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#22c55e' }}
                        activeDot={{ r: 5 }}
                    />
                    <Line
                        type="monotone"
                        dataKey="Avg Minus"
                        stroke="#ef4444"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#ef4444' }}
                        activeDot={{ r: 5 }}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    )
}
