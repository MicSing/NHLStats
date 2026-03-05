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

    return (
        <div role="img" aria-label="plus minus chart" className="w-full">
            {data.length === 0 ? (
                <p className="text-text-muted text-sm text-center py-8">No data available</p>
            ) : (
                <>
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                            <XAxis dataKey="userName" tick={{ fill: ct.tick, fontSize: 12 }} />
                            <YAxis tick={{ fill: ct.tick, fontSize: 12 }} />
                            <Tooltip
                                contentStyle={{ backgroundColor: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, color: ct.tooltipText }}
                            />
                            <Legend wrapperStyle={{ color: ct.legendText }} />
                            <Bar dataKey="totalPlus" name="+" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="totalMinus" name="−" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                    {/* Accessible data summary — also picked up by tests */}
                    <ul className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-xs text-text-muted" aria-hidden="false">
                        {data.map((d) => (
                            <li key={d.userId}>
                                <span className="font-medium text-text">{d.userName}</span>{' '}
                                <span className="text-primary">+{d.totalPlus}</span>{' '}
                                <span className="text-danger">−{d.totalMinus}</span>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    )
}
