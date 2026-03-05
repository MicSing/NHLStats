import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts'
import type { UserEarnings } from '../../types/stats'
import { useChartTheme } from './useChartTheme'

interface Props {
    data: UserEarnings[]
}

export default function EarningsChart({ data }: Props) {
    const ct = useChartTheme()
    const sorted = [...data].sort((a, b) => b.remainingBalance - a.remainingBalance)

    return (
        <div role="img" aria-label="earnings chart" className="w-full">
            {data.length === 0 ? (
                <p className="text-text-muted text-sm text-center py-8">No data available</p>
            ) : (
                <>
                    <ResponsiveContainer width="100%" height={280}>
                        <LineChart
                            data={sorted}
                            margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                            <XAxis dataKey="userName" tick={{ fill: ct.tick, fontSize: 12 }} />
                            <YAxis
                                tickFormatter={(v: number) => `${v.toFixed(2)} €`}
                                tick={{ fill: ct.tick, fontSize: 12 }}
                            />
                            <Tooltip
                                formatter={(v: number | undefined) => [`${(v ?? 0).toFixed(2)} €`, 'Balance']}
                                contentStyle={{ backgroundColor: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, color: ct.tooltipText }}
                            />
                            <Line
                                type="monotone"
                                dataKey="remainingBalance"
                                name="Balance"
                                stroke="#f97316"
                                strokeWidth={2}
                                dot={{ fill: '#f97316', r: 4 }}
                                activeDot={{ r: 6 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                    {/* Accessible data summary */}
                    <ul className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-xs text-text-muted">
                        {sorted.map((d) => (
                            <li key={d.userId}>
                                <span className="font-medium text-text">{d.userName}</span>{' '}
                                <span className={d.remainingBalance > 0 ? 'text-danger' : 'text-success'}>
                                    {d.remainingBalance.toFixed(2)} €
                                </span>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    )
}
