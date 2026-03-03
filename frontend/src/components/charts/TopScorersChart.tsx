import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts'
import type { TopRosterPlayer } from '../../types/stats'

interface Props {
    data: TopRosterPlayer[]
}

export default function TopScorersChart({ data }: Props) {
    const chartData = [...data]
        .sort((a, b) => b.count - a.count)
        .map((p) => ({
            ...p,
            displayName: `${p.firstName} ${p.surname}${p.teamShortName ? ` (${p.teamShortName})` : ''}`,
        }))

    return (
        <div role="img" aria-label="top scorers chart" className="w-full">
            {data.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No data available</p>
            ) : (
                <>
                    <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 40)}>
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
                                formatter={(value: number) => [`${value} goals`, 'Goals']}
                            />
                            <Bar dataKey="count" name="Goals" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                    {/* Accessible data summary */}
                    <ul className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-xs text-gray-400">
                        {chartData.map((d) => (
                            <li key={d.rosterPlayerId}>
                                <span className="font-medium text-white">{d.displayName}</span>{' '}
                                <span className="text-cyan-400">{d.count} goals</span>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    )
}
