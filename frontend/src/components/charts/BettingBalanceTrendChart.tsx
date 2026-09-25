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
import { useState } from 'react'
import type { WeeklyBettingBalancePeriod } from '../../types/stats'
import { combineBalance, type BalanceComponents } from '../../utils/bettingBalance'
import { useChartTheme } from './useChartTheme'
import { useHighlightedUsers } from './useHighlightedUsers'
import { useTranslation } from 'react-i18next'

import { getUserColor } from '../../utils/userColors'

interface Props {
    data: WeeklyBettingBalancePeriod[]
    /** Payouts only make sense across all seasons, so the option is opt-in. */
    showPayouts?: boolean
}

const COMPONENT_KEYS = ['bets', 'positive', 'negative'] as const

export default function BettingBalanceTrendChart({ data, showPayouts = false }: Props) {
    const ct = useChartTheme()
    const { t } = useTranslation()
    const [selected, setSelected] = useState<BalanceComponents>({ bets: true, positive: true, negative: false, payouts: false })
    const componentKeys = showPayouts ? [...COMPONENT_KEYS, 'payouts' as const] : COMPONENT_KEYS
    const effectiveSelected = showPayouts ? selected : { ...selected, payouts: false }
    const { lineProps, legendProps, isHighlighted } = useHighlightedUsers(
        new Set(data.flatMap((p) => p.users.map((u) => u.userId))).size
    )

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
    const allUsers = Array.from(userMap.entries())
        .map(([userId, userName]) => ({ userId, userName }))
        .sort((a, b) => a.userId - b.userId)

    const chartData = data.map((period) => {
        const entry: Record<string, unknown> = { label: period.label }
        for (const user of allUsers) {
            const match = period.users.find((u) => u.userId === user.userId)
            entry[user.userName] = match ? combineBalance(match, effectiveSelected) : 0
        }
        return entry
    })

    return (
        <div className="w-full">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2">
                {componentKeys.map((key) => (
                    <label key={key} className="flex items-center gap-1.5 text-xs text-text cursor-pointer">
                        <input
                            type="checkbox"
                            checked={!!selected[key]}
                            onChange={(e) => setSelected((prev) => ({ ...prev, [key]: e.target.checked }))}
                            className="accent-[var(--color-primary)]"
                        />
                        {t(`bettingBalanceChart.${key}`)}
                    </label>
                ))}
            </div>
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
                            domain={['auto', 'auto']}
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
                        <Legend wrapperStyle={{ color: ct.legendText, fontSize: 12 }} {...legendProps} />
                        {allUsers.map((user) => (
                            <Line
                                key={user.userId}
                                type="monotone"
                                dataKey={user.userName}
                                stroke={getUserColor(user.userId)}
                                {...lineProps(user.userName)}
                                dot={false}
                                activeDot={isHighlighted(user.userName) ? { r: 6 } : false}
                                connectNulls
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
