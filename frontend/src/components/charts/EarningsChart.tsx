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
import type { AllTimeEarnings, SeasonalUserEarnings } from '../../types/stats'
import type { User } from '../../types/user'
import type { Season } from '../../types/season'
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
    data: SeasonalUserEarnings[]
    selectedSeasonId: number | null
    users: User[]
    seasons: Season[]
    allTimeEarnings?: AllTimeEarnings
}

interface ChartRow {
    userName: string
    [seasonName: string]: string | number
}

export default function EarningsChart({ data, selectedSeasonId, users, seasons, allTimeEarnings }: Props) {
    const ct = useChartTheme()
    const [hoveredSeason, setHoveredSeason] = useState<string | null>(null)

    const userNameById = new Map(users.map((u) => [u.id, u.name]))
    const seasonNameById = new Map(seasons.map((s) => [s.id, s.name]))

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

    // Seed userMap from allTimeEarnings so every user appears even if absent from a season
    const userMap = new Map<number, string>()
    if (!selectedSeasonId && allTimeEarnings) {
        for (const ue of allTimeEarnings.userEarnings) {
            userMap.set(ue.userId, userNameById.get(ue.userId) ?? `User ${ue.userId}`)
        }
    }
    for (const season of filteredSeasons) {
        for (const u of season.userEarnings) {
            if (!userMap.has(u.userId)) {
                userMap.set(u.userId, userNameById.get(u.userId) ?? `User ${u.userId}`)
            }
        }
    }

    // Build chart data: one row per user, season names as keys
    // Seasons are already ordered chronologically from the API — first season at bottom, last at top
    const seasonNames = filteredSeasons.map((s) => seasonNameById.get(s.seasonId) ?? `Season ${s.seasonId}`)
    const chartData: ChartRow[] = Array.from(userMap.entries()).map(([userId, userName]) => {
        const row: ChartRow = { userName }
        for (let i = 0; i < filteredSeasons.length; i++) {
            const season = filteredSeasons[i]
            const seasonName = seasonNames[i]
            const userEntry = season.userEarnings.find((u) => u.userId === userId)
            row[seasonName] = userEntry ? Number(userEntry.earnings.toFixed(2)) : 0
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
            <ul className="hidden" aria-hidden="true">
                {chartData.map((d) => (
                    <li key={d.userName}>{d.userName}</li>
                ))}
            </ul>
            <ResponsiveContainer width="100%" height={280}>
                <BarChart
                    data={chartData}
                    margin={{ top: 10, right: 30, left: 0, bottom: 5 }}
                >
                    <CartesianGrid strokeDasharray="4 4" stroke={ct.grid} />
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
        </div>
    )
}
