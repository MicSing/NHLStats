import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ReferenceLine,
    ResponsiveContainer,
} from 'recharts'
import type { UserEarnings } from '../../types/stats'

interface Props {
    data: UserEarnings[]
}

export default function EarningsChart({ data }: Props) {
    const sorted = [...data].sort((a, b) => b.totalEarnings - a.totalEarnings)

    return (
        <div role="img" aria-label="earnings chart" className="w-full">
            {data.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No data available</p>
            ) : (
                <>
                    <ResponsiveContainer width="100%" height={280}>
                        <LineChart
                            data={sorted}
                            margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="userName" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                            <YAxis
                                tickFormatter={(v: number) => `${v.toFixed(2)} €`}
                                tick={{ fill: '#9ca3af', fontSize: 12 }}
                            />
                            <Tooltip
                                formatter={(v: number) => [`${v.toFixed(2)} €`, 'Earnings']}
                                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#fff' }}
                            />
                            <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="4 4" />
                            <Line
                                type="monotone"
                                dataKey="totalEarnings"
                                name="Earnings"
                                stroke="#f97316"
                                strokeWidth={2}
                                dot={{ fill: '#f97316', r: 4 }}
                                activeDot={{ r: 6 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                    {/* Accessible data summary */}
                    <ul className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-xs text-gray-400">
                        {sorted.map((d) => (
                            <li key={d.userId}>
                                <span className="font-medium text-white">{d.userName}</span>{' '}
                                <span className={d.totalEarnings >= 0 ? 'text-green-400' : 'text-red-400'}>
                                    {d.totalEarnings.toFixed(2)} €
                                </span>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    )
}
