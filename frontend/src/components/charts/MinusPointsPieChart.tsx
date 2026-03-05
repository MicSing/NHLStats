import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts'
import type { PointReasonBreakdownItem } from '../../types/stats'

interface Props {
    items: PointReasonBreakdownItem[]
}

const COLORS = [
    '#ef4444', // red
    '#f97316', // orange
    '#eab308', // yellow
    '#a855f7', // purple
    '#ec4899', // pink
    '#14b8a6', // teal
    '#64748b', // slate
    '#06b6d4', // cyan
]

interface LabelProps {
    cx: number
    cy: number
    midAngle: number
    innerRadius: number
    outerRadius: number
    value: number
}

const RADIAN = Math.PI / 180

function renderCustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, value }: LabelProps) {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.6
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)
    return (
        <text
            x={x}
            y={y}
            fill="#fff"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={12}
            fontWeight="bold"
        >
            {value}
        </text>
    )
}

export default function MinusPointsPieChart({ items }: Props) {
    // Pre-filter to negatives only (caller may pass already filtered, but guard here too)
    const negativeItems = items.filter((i) => !i.isPositive)

    if (negativeItems.length === 0) {
        return (
            <div role="img" aria-label="minus points pie chart" className="w-full flex items-center justify-center py-12">
                <p className="text-text-muted text-sm">No data yet</p>
            </div>
        )
    }

    const chartData = negativeItems.map((i) => ({
        name: i.pointReasonName,
        value: i.totalCount,
    }))

    return (
        <div role="img" aria-label="minus points pie chart" className="w-full">
            <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        dataKey="value"
                        labelLine={false}
                        label={renderCustomLabel as unknown as boolean}
                    >
                        {chartData.map((_entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                            />
                        ))}
                    </Pie>
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#1f2937',
                            border: '1px solid #374151',
                            color: '#fff',
                        }}
                        formatter={(value: number | undefined) => [value ?? 0, 'Count']}
                    />
                    <Legend
                        wrapperStyle={{ color: '#9ca3af', fontSize: 12 }}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    )
}
