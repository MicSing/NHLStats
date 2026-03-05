import { useState } from 'react'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts'
import type { SeasonEarningsEntry } from '../../types/stats'
import { useChartTheme } from './useChartTheme'

// A curated palette of distinguishable colors for stacked seasons
const SEASON_COLORS = [
    '#3b82f6', // blue
    '#f97316', // orange
    '#10b981', // emerald
    '#ef4444', // red
    '#8b5cf6', // violet
    '#f59e0b', // amber
    '#06b6d4', // cyan
    '#ec4899', // pink
    '#84cc16', // lime
    '#6366f1', // indigo
]

interface Props {
    /** All per-season earnings data (from /api/stats/earnings-by-season) */
    data: SeasonEarningsEntry[]
    /** Currently selected season id, or null for "all seasons" */
    selectedSeasonId: number | null
}

interface ChartRow {
    userName: string
    [seasonName: string]: string | number
}

export default function EarningsChart({ data, selectedSeasonId }: Props) {
    const ct = useChartTheme()
    const [hoveredSeason, setHoveredSeason] = useState<string | null>(null)

    // Filter seasons based on selection
    const filteredSeasons = selectedSeasonId
        ? data.filter((s) => s.seasonId === selectedSeasonId)
        : data

    if (filteredSeasons.length === 0) {
        return (
            <div role="img" aria-label="earnings chart" className="w-full">
                <p className="text-text-muted text-sm text-center py-8">No data available</p>
            </div>
        )
    }

    // Collect all unique users across the selected seasons
    const userMap = new Map<number, string>()
    for (const season of filteredSeasons) {
        for (const u of season.users) {
            if (!userMap.has(u.userId)) userMap.set(u.userId, u.userName)
        }
    }

    // Build chart data: one row per user, season names as keys
    // Seasons are already ordered chronologically from the API — first season at bottom, last at top
    const seasonNames = filteredSeasons.map((s) => s.seasonName)
    const chartData: ChartRow[] = Array.from(userMap.entries()).map(([userId, userName]) => {
        const row: ChartRow = { userName }
        for (const season of filteredSeasons) {
            const userEntry = season.users.find((u) => u.userId === userId)
            row[season.seasonName] = userEntry ? Number(userEntry.earnings.toFixed(2)) : 0
        }
        return row
    })

    // Sort by total earnings descending
    chartData.sort((a, b) => {
        const totalA = seasonNames.reduce((sum, sn) => sum + ((a[sn] as number) || 0), 0)
        const totalB = seasonNames.reduce((sum, sn) => sum + ((b[sn] as number) || 0), 0)
        return totalB - totalA
    })

    return (
        <div role="img" aria-label="earnings chart" className="w-full">
            <ResponsiveContainer width="100%" height={280}>
                <BarChart
                    data={chartData}
                    margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                    <XAxis dataKey="userName" tick={{ fill: ct.tick, fontSize: 12 }} />
                    <YAxis
                        tickFormatter={(v: number) => `${v.toFixed(2)} €`}
                        tick={{ fill: ct.tick, fontSize: 12 }}
                    />
                    <Tooltip
                        formatter={(v: number | undefined, name?: string) => [
                            `${(v ?? 0).toFixed(2)} €`,
                            name ?? '',
                        ]}
                        contentStyle={{
                            backgroundColor: ct.tooltipBg,
                            border: `1px solid ${ct.tooltipBorder}`,
                            color: ct.tooltipText,
                        }}
                        wrapperStyle={{ zIndex: 10 }}
                    />
                    {seasonNames.length > 1 && (
                        <Legend
                            wrapperStyle={{ color: ct.legendText, fontSize: 12 }}
                            content={({ payload }) => {
                                // Reverse so latest season appears first in legend
                                const items = payload ? [...payload].reverse() : []
                                return (
                                    <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-1">
                                        {items.map((entry) => (
                                            <li
                                                key={String(entry.dataKey ?? entry.value)}
                                                className="flex items-center gap-1 cursor-pointer select-none"
                                                onMouseEnter={() => {
                                                    const key = typeof entry.dataKey === 'string' ? entry.dataKey : null
                                                    setHoveredSeason(key ?? String(entry.value ?? ''))
                                                }}
                                                onMouseLeave={() => setHoveredSeason(null)}
                                            >
                                                <span
                                                    className="inline-block w-3 h-3 rounded-sm"
                                                    style={{ backgroundColor: entry.color }}
                                                />
                                                <span style={{ color: ct.legendText, fontSize: 12 }}>
                                                    {entry.value}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )
                            }}
                        />
                    )}
                    {/* Bars rendered in order: first season first (bottom of stack) */}
                    {seasonNames.map((sn, i) => (
                        <Bar
                            key={sn}
                            dataKey={sn}
                            name={sn}
                            stackId="earnings"
                            fill={SEASON_COLORS[i % SEASON_COLORS.length]}
                            fillOpacity={
                                hoveredSeason === null || hoveredSeason === sn ? 1 : 0.15
                            }
                        />
                    ))}
                </BarChart>
            </ResponsiveContainer>
            {/* Accessible data summary */}
            <ul className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-xs text-text-muted">
                {chartData.map((d) => {
                    const total = seasonNames.reduce(
                        (sum, sn) => sum + ((d[sn] as number) || 0),
                        0,
                    )
                    return (
                        <li key={d.userName}>
                            <span className="font-medium text-text">{d.userName}</span>{' '}
                            <span className={total > 0 ? 'text-danger' : 'text-success'}>
                                {total.toFixed(2)} €
                            </span>
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}
