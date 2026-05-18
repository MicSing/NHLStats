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
import type { WeeklyBettingBalancePeriod } from '../../types/stats'
import { useChartTheme } from './useChartTheme'
import { useTranslation } from 'react-i18next'

const USER_COLORS = [
    '#3B82F6',
    '#8B5CF6',
    '#F59E0B',
    '#EC4899',
    '#06B6D4',
    '#10B981',
    '#64748B',
    '#F97316',
    '#EF4444',
    '#22C55E',
]

interface Props {
    data: WeeklyBettingBalancePeriod[]
    isWeekly?: boolean
}

export default function BettingBalanceTrendChart({ data, isWeekly }: Props) {
    const ct = useChartTheme()
    const { t } = useTranslation()

    if (data.length === 0) {
        return (
            <div className="w-full">
                <p className="text-text-muted text-sm text-center py-8">{t('trendChart.noData')}</p>
            </div>
        )
    }

    const userMap = new Map<number, string>()
    for (const period of data) {
        for (const u of period.users) {
            if (!userMap.has(u.userId)) userMap.set(u.userId, u.userName)
        }
    }
    const allUsers = Array.from(userMap.entries()).map(([userId, userName]) => ({ userId, userName }))

    const chartData = data.map((period) => {
        const entry: Record<string, unknown> = { label: period.label }
        for (const user of allUsers) {
            const match = period.users.find((u) => u.userId === user.userId)
            entry[user.userName] = match ? match.balance : 0
        }
        return entry
    })

    return (
        <div className="w-full">
            <div className="h-[200px] sm:h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={ct.margin}>
                        <CartesianGrid strokeDasharray="4 4" stroke={ct.grid} />
                        <XAxis
                            dataKey="label"
                            tick={{ fill: ct.tick, fontSize: 11 }}
                            angle={-20}
                            textAnchor="end"
                            height={60}
                        />
                        <YAxis
                            tick={{ fill: ct.tick, fontSize: 12 }}
                            domain={isWeekly ? ['auto', 'auto'] : [0, 'auto']}
                            tickFormatter={(v) => `${Number(v).toFixed(2)} €`}
                            width={ct.yAxisWidthCurrency}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: ct.tooltipBg,
                                border: `1px solid ${ct.tooltipBorder}`,
                                color: ct.tooltipText,
                            }}
                            formatter={(value) => [`${Number(value).toFixed(2)} €`]}
                        />
                        <Legend wrapperStyle={{ color: ct.legendText, fontSize: 12 }} />
                        {allUsers.map((user, i) => (
                            <Line
                                key={user.userId}
                                type="monotone"
                                dataKey={user.userName}
                                stroke={USER_COLORS[i % USER_COLORS.length]}
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 6 }}
                                connectNulls
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
