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
import type { RosterScorerByUser } from '../../types/stats'
import { useChartTheme } from './useChartTheme'

const USER_COLORS = ['#06b6d4', '#f97316', '#a855f7', '#22c55e', '#eab308', '#ec4899', '#14b8a6', '#64748b']
const TOP_N = 5

interface Props {
    data: RosterScorerByUser[]
    hideLegend?: boolean
}

export default function TopScorersChart({ data, hideLegend = false }: Props) {
    const [showAll, setShowAll] = useState(false)
    const [selectedUserNames, setSelectedUserNames] = useState<Set<string> | null>(null)
    const ct = useChartTheme()

    // Collect all unique users in a stable order (highest total scorer first)
    const allUsers = Array.from(
        new Map(
            data
                .flatMap((p) => p.userCounts)
                .sort((a, b) => b.count - a.count)
                .map((uc) => [uc.userId, uc.userName] as [number, string]),
        ).entries(),
    ).map(([userId, userName]) => ({ userId, userName }))

    function toggleUser(userName: string) {
        setSelectedUserNames((prev) => {
            if (prev === null) return new Set([userName])
            if (prev.size === 1 && prev.has(userName)) return null
            const next = new Set(prev)
            if (next.has(userName)) {
                next.delete(userName)
            } else {
                next.add(userName)
                if (next.size === allUsers.length) return null
            }
            return next
        })
    }

    const effectiveData: Record<string, unknown>[] = (() => {
        const source = selectedUserNames === null
            ? data
            : data.filter((p) => p.userCounts.some((uc) => selectedUserNames.has(uc.userName) && uc.count > 0))
        return [...source]
            .map((p) => {
                const total = selectedUserNames === null
                    ? p.totalCount
                    : p.userCounts.filter((uc) => selectedUserNames.has(uc.userName)).reduce((s, uc) => s + uc.count, 0)
                const entry: Record<string, unknown> = {
                    displayName: `${p.firstName} ${p.surname}${p.teamShortName ? ` (${p.teamShortName})` : ''}`,
                    rosterPlayerId: p.rosterPlayerId,
                    totalCount: total,
                }
                for (const uc of p.userCounts) {
                    entry[uc.userName] = uc.count
                }
                return entry
            })
            .sort((a, b) => (b.totalCount as number) - (a.totalCount as number))
    })()

    const visibleData = showAll ? effectiveData : effectiveData.slice(0, TOP_N)
    const hasMore = effectiveData.length > TOP_N

    return (
        <div role="img" aria-label="top scorers chart" className="w-full">
            {data.length === 0 ? (
                <p className="text-text-muted text-sm text-center py-8">No data available</p>
            ) : (
                <>
                    <ResponsiveContainer width="100%" height={Math.max(280, visibleData.length * 50)}>
                        <BarChart
                            data={visibleData}
                            layout="vertical"
                            margin={{ top: 10, right: 30, left: 80, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                            <XAxis type="number" allowDecimals={false} tick={{ fill: ct.tick, fontSize: 12 }} />
                            <YAxis
                                dataKey="displayName"
                                type="category"
                                tick={{ fill: ct.tick, fontSize: 11 }}
                                width={80}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, color: ct.tooltipText }}
                                formatter={(value: number | undefined, name: string | undefined) => [`${value ?? 0} goals`, name ?? '']}
                            />
                            {!hideLegend && (
                                <Legend
                                    wrapperStyle={{ color: ct.legendText, fontSize: 12 }}
                                    onClick={(entry) => toggleUser(entry.value as string)}
                                    formatter={(value) => {
                                        const isSelected = selectedUserNames === null || selectedUserNames.has(value)
                                        return (
                                            <span style={{ opacity: isSelected ? 1 : 0.5, cursor: allUsers.length > 1 ? 'pointer' : 'default' }}>
                                                {value}
                                            </span>
                                        )
                                    }}
                                />
                            )}
                            {allUsers.map((u, i) => (
                                <Bar
                                    key={u.userId}
                                    dataKey={u.userName}
                                    stackId="goals"
                                    fill={USER_COLORS[i % USER_COLORS.length]}
                                    hide={selectedUserNames !== null && !selectedUserNames.has(u.userName)}
                                    radius={i === allUsers.length - 1 ? [0, 4, 4, 0] : undefined}
                                />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                    {/* Accessible data summary */}
                    <ul className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-xs text-text-muted">
                        {visibleData.map((d) => (
                            <li key={d.rosterPlayerId as number}>
                                <span className="font-medium text-text">{d.displayName as string}</span>{' '}
                                <span className="text-primary">{d.totalCount as number} goals</span>
                            </li>
                        ))}
                    </ul>
                    {hasMore && (
                        <button
                            onClick={() => setShowAll((v) => !v)}
                            className="mt-3 text-xs text-primary hover:underline w-full text-center"
                        >
                            {showAll ? 'Show less' : `Show all ${effectiveData.length} players`}
                        </button>
                    )}
                </>
            )}
        </div>
    )
}
