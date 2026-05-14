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

const USER_COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4', '#10B981', '#64748B', '#F97316']
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
                    <ResponsiveContainer width="100%" height={Math.max(220, visibleData.length * 44)}>
                        <BarChart
                            data={visibleData}
                            layout="vertical"
                            margin={ct.margin}
                        >
                            <CartesianGrid strokeDasharray="4 4" stroke={ct.grid} />
                            <XAxis type="number" allowDecimals={false} tick={{ fill: ct.tick, fontSize: 12 }} />
                            <YAxis
                                dataKey="displayName"
                                type="category"
                                tick={{ fill: ct.tick, fontSize: 11 }}
                                width={70}
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
