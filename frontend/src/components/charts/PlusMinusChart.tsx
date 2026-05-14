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
import type { UserSeasonStats } from '../../types/stats'
import { useChartTheme } from './useChartTheme'

interface Props {
    data: UserSeasonStats[]
}

export default function PlusMinusChart({ data }: Props) {
    const ct = useChartTheme()

    const chartData = data.map((d) => ({
        userName: d.userName,
        plus: d.totalPlus,
        minus: -d.totalMinus,
    }))

    return (
        <div role="img" aria-label="plus minus chart" className="w-full">
            {data.length === 0 ? (
                <p className="text-text-muted text-sm text-center py-8">No data available</p>
            ) : (
                <>
                    <ul className="hidden" aria-hidden="true">
                        {data.map((d) => (
                            <li key={d.userId}>{d.userName}</li>
                        ))}
                    </ul>
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart
                            data={chartData}
                            stackOffset="sign"
                            margin={{ top: 10, right: 30, left: 0, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="4 4" stroke={ct.grid} />
                            <XAxis dataKey="userName" tick={{ fill: ct.tick, fontSize: 12 }} />
                            <YAxis
                                tick={{ fill: ct.tick, fontSize: 12 }}
                                tickFormatter={(v: number) => String(Math.abs(v))}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: ct.tooltipBg,
                                    border: `1px solid ${ct.tooltipBorder}`,
                                    color: ct.tooltipText,
                                }}
                                formatter={(value: number | undefined, name: string | undefined) => [Math.abs(value ?? 0), name ?? '']}
                            />
                            <Legend wrapperStyle={{ color: ct.legendText }} />
                            <Bar dataKey="plus" name="+" stackId="a" fill="#10B981" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="minus" name="−" stackId="a" fill="#EF4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </>
            )}
        </div>
    )
}
