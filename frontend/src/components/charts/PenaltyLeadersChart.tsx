import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts'
import type { UserSeasonStats } from '../../types/stats'

interface Props {
    data: UserSeasonStats[]
}

export default function PenaltyLeadersChart({ data }: Props) {
    const sorted = [...data].sort((a, b) => b.totalMinus - a.totalMinus)

    return (
        <div role="img" aria-label="penalty leaders chart" className="w-full">
            {data.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No data available</p>
            ) : (
                <>
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart
                            data={sorted}
                            layout="vertical"
                            margin={{ top: 10, right: 30, left: 60, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                            <YAxis
                                dataKey="userName"
                                type="category"
                                tick={{ fill: '#9ca3af', fontSize: 12 }}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#fff' }}
                            />
                            <Bar dataKey="totalMinus" name="−" fill="#ef4444" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                    {/* Accessible data summary */}
                    <ul className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-xs text-gray-400">
                        {sorted.map((d) => (
                            <li key={d.userId}>
                                <span className="font-medium text-white">{d.userName}</span>{' '}
                                <span className="text-red-400">−{d.totalMinus}</span>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    )
}
