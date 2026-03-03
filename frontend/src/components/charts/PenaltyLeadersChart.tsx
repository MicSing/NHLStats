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
import type { RosterPenalizedByUser } from '../../types/stats'

const USER_COLORS = ['#ef4444', '#f97316', '#a855f7', '#06b6d4', '#eab308', '#ec4899', '#22c55e', '#64748b']

interface Props {
    data: RosterPenalizedByUser[]
}

export default function PenaltyLeadersChart({ data }: Props) {
    // Collect all unique users in a stable order (highest total penalty scorer first)
    const allUsers = Array.from(
        new Map(
            data
                .flatMap((p) => p.userCounts)
                .sort((a, b) => b.count - a.count)
                .map((uc) => [uc.userId, uc.userName] as [number, string]),
        ).entries(),
    ).map(([userId, userName]) => ({ userId, userName }))

    const chartData = [...data]
        .sort((a, b) => b.totalCount - a.totalCount)
        .map((p) => {
            const entry: Record<string, unknown> = {
                displayName: `${p.firstName} ${p.surname}${p.teamShortName ? ` (${p.teamShortName})` : ''}`,
                rosterPlayerId: p.rosterPlayerId,
                totalCount: p.totalCount,
            }
            for (const uc of p.userCounts) {
                entry[uc.userName] = uc.count
            }
            return entry
        })

    return (
        <div role="img" aria-label="penalty leaders chart" className="w-full">
            {data.length === 0 ? (
                <p className="text-text-muted text-sm text-center py-8">No data available</p>
            ) : (
                <>
                    <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 50)}>
                        <BarChart
                            data={chartData}
                            layout="vertical"
                            margin={{ top: 10, right: 30, left: 80, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis type="number" allowDecimals={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                            <YAxis
                                dataKey="displayName"
                                type="category"
                                tick={{ fill: '#9ca3af', fontSize: 11 }}
                                width={80}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#fff' }}
                                formatter={(value: number | undefined, name: string | undefined) => [`${value ?? 0} pen`, name ?? '']}
                            />
                            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
                            {allUsers.map((u, i) => (
                                <Bar
                                    key={u.userId}
                                    dataKey={u.userName}
                                    stackId="penalties"
                                    fill={USER_COLORS[i % USER_COLORS.length]}
                                    radius={i === allUsers.length - 1 ? [0, 4, 4, 0] : undefined}
                                />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                    {/* Accessible data summary */}
                    <ul className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-xs text-text-muted">
                        {chartData.map((d) => (
                            <li key={d.rosterPlayerId as number}>
                                <span className="font-medium text-white">{d.displayName as string}</span>{' '}
                                <span className="text-danger">{d.totalCount as number} pen</span>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    )
}
