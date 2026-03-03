import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts'
import type { PeriodPlusMinus } from '../../types/stats'

const USER_COLORS = [
    '#06b6d4', // cyan
    '#f97316', // orange
    '#a855f7', // purple
    '#22c55e', // green
    '#eab308', // yellow
    '#ec4899', // pink
    '#14b8a6', // teal
    '#64748b', // slate
    '#ef4444', // red
    '#3b82f6', // blue
]

type Mode = 'plus' | 'minus'

interface Props {
    data: PeriodPlusMinus[]
    mode: Mode
}

/**
 * Simple linear regression: returns { slope, intercept } for arrays x, y.
 */
function linearRegression(x: number[], y: number[]): { slope: number; intercept: number } {
    const n = x.length
    if (n === 0) return { slope: 0, intercept: 0 }
    const sumX = x.reduce((a, b) => a + b, 0)
    const sumY = y.reduce((a, b) => a + b, 0)
    const sumXY = x.reduce((a, xi, i) => a + xi * y[i], 0)
    const sumXX = x.reduce((a, xi) => a + xi * xi, 0)
    const denom = n * sumXX - sumX * sumX
    if (denom === 0) return { slope: 0, intercept: sumY / n }
    const slope = (n * sumXY - sumX * sumY) / denom
    const intercept = (sumY - slope * sumX) / n
    return { slope, intercept }
}

export default function TrendChart({ data, mode }: Props) {
    const ariaLabel = mode === 'plus' ? 'plus trend chart' : 'minus trend chart'

    if (data.length === 0) {
        return (
            <div role="img" aria-label={ariaLabel} className="w-full">
                <p className="text-text-muted text-sm text-center py-8">No data available</p>
            </div>
        )
    }

    // Collect all unique users across all periods
    const userMap = new Map<number, string>()
    for (const period of data) {
        for (const u of period.users) {
            if (!userMap.has(u.userId)) {
                userMap.set(u.userId, u.userName)
            }
        }
    }
    const allUsers = Array.from(userMap.entries()).map(([userId, userName]) => ({
        userId,
        userName,
    }))

    // Extract the value for the chosen mode (always >= 0)
    const getValue = (u: { totalPlus: number; totalMinus: number }) =>
        mode === 'plus' ? u.totalPlus : u.totalMinus

    // Build chart data: each point is a period, with one key per user
    const chartData: Record<string, unknown>[] = data.map((period) => {
        const entry: Record<string, unknown> = { label: period.label }
        for (const user of allUsers) {
            const match = period.users.find((u) => u.userId === user.userId)
            entry[user.userName] = match ? getValue(match) : 0
        }
        return entry
    })

    // Predict next period using linear regression per user
    const predictionEntry: Record<string, unknown> = {
        label: 'Next (predicted)',
        _isPrediction: true,
    }
    const xValues = data.map((_, i) => i)
    const nextX = data.length

    for (const user of allUsers) {
        const yValues = data.map((period) => {
            const match = period.users.find((u) => u.userId === user.userId)
            return match ? getValue(match) : 0
        })
        const { slope, intercept } = linearRegression(xValues, yValues)
        // Clamp prediction to 0 (can't be negative for individual plus/minus counts)
        predictionEntry[user.userName] = Math.max(0, Math.round(intercept + slope * nextX))
    }

    const chartDataWithPrediction = [...chartData, predictionEntry]
    const lineColor = mode === 'plus' ? '#06b6d4' : '#ef4444' // fallback accent

    return (
        <div role="img" aria-label={ariaLabel} className="w-full">
            <ResponsiveContainer width="100%" height={280}>
                <LineChart
                    data={chartDataWithPrediction}
                    margin={{ top: 10, right: 30, left: 0, bottom: 5 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                        dataKey="label"
                        tick={{ fill: '#9ca3af', fontSize: 11 }}
                        angle={-20}
                        textAnchor="end"
                        height={60}
                    />
                    <YAxis
                        tick={{ fill: '#9ca3af', fontSize: 12 }}
                        domain={[0, 'auto']}
                        allowDecimals={false}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#1f2937',
                            border: '1px solid #374151',
                            color: '#fff',
                        }}
                    />
                    <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />

                    {allUsers.map((user, i) => (
                        <Line
                            key={user.userId}
                            type="monotone"
                            dataKey={user.userName}
                            stroke={USER_COLORS[i % USER_COLORS.length]}
                            strokeWidth={2}
                            dot={(props: Record<string, unknown>) => {
                                const { cx, cy, index } = props as {
                                    cx: number
                                    cy: number
                                    index: number
                                }
                                if (index === chartDataWithPrediction.length - 1) {
                                    // Prediction dot — hollow dashed circle
                                    return (
                                        <circle
                                            cx={cx}
                                            cy={cy}
                                            r={4}
                                            fill="none"
                                            stroke={USER_COLORS[i % USER_COLORS.length]}
                                            strokeWidth={2}
                                            strokeDasharray="3 2"
                                        />
                                    )
                                }
                                return (
                                    <circle
                                        cx={cx}
                                        cy={cy}
                                        r={4}
                                        fill={USER_COLORS[i % USER_COLORS.length]}
                                        stroke="none"
                                    />
                                )
                            }}
                            activeDot={false}
                            connectNulls
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>

            {/* Prediction note */}
            <p className="text-text-muted text-xs text-center mt-1 italic">
                Dashed dot = linear regression prediction for the next period
            </p>

            {/* Accessible data summary */}
            <ul className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-xs text-text-muted">
                {allUsers.map((user, i) => {
                    const latestPeriod = data[data.length - 1]
                    const latestMatch = latestPeriod?.users.find((u) => u.userId === user.userId)
                    const latestValue = latestMatch ? getValue(latestMatch) : 0
                    const predicted = predictionEntry[user.userName] as number
                    return (
                        <li key={user.userId}>
                            <span
                                className="inline-block w-2 h-2 rounded-full mr-1"
                                style={{ backgroundColor: USER_COLORS[i % USER_COLORS.length] }}
                            />
                            <span className="font-medium text-white">{user.userName}</span>{' '}
                            <span className={mode === 'plus' ? 'text-primary' : 'text-danger'}>
                                {latestValue}
                            </span>
                            <span className="text-text-muted"> → {predicted}</span>
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}
