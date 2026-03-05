import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceLine,
} from 'recharts'
import type { PointReasonBreakdownItem } from '../../types/stats'

const PENALTY_REASON_NAMES = ['penalty', 'secondary penalty']
const ROSTER_COLOR = '#ef4444'   // red — actual ice penalties
const PENALTY_COLOR = '#f97316'  // orange — Penalty point deductions
const SEC_PEN_COLOR = '#eab308'  // yellow — Secondary Penalty point deductions

interface RosterPenalty {
    playerName: string
    count: number
}

interface Props {
    items: PointReasonBreakdownItem[]
    rosterPenalties: RosterPenalty[]
}

export default function PenaltyPointedChart({ items, rosterPenalties }: Props) {
    const totalRoster = rosterPenalties.reduce((s, p) => s + p.count, 0)

    const penaltyPts = items.find(
        (i) => !i.isPositive && i.pointReasonName.toLowerCase() === 'penalty',
    )?.totalCount ?? 0

    const secPenaltyPts = items.find(
        (i) => !i.isPositive && i.pointReasonName.toLowerCase() === 'secondary penalty',
    )?.totalCount ?? 0

    const hasData = totalRoster > 0 || penaltyPts > 0 || secPenaltyPts > 0

    if (!hasData) {
        return (
            <div role="img" aria-label="penalty chart" className="w-full flex items-center justify-center py-12">
                <p className="text-text-muted text-sm">No data yet</p>
            </div>
        )
    }

    // Single grouped bar chart — one "category" with 3 bars side by side
    const chartData = [
        {
            label: 'Penalties',
            'Roster penalties': totalRoster,
            'Penalty (−pts)': penaltyPts,
            'Secondary Penalty (−pts)': secPenaltyPts,
        },
    ]

    const totalPts = penaltyPts + secPenaltyPts
    const diff = totalRoster - totalPts

    return (
        <div role="img" aria-label="penalty chart" className="w-full">
            <ResponsiveContainer width="100%" height={240}>
                <BarChart
                    data={chartData}
                    margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                    barCategoryGap="30%"
                    barGap={4}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#1f2937',
                            border: '1px solid #374151',
                            color: '#fff',
                        }}
                    />
                    <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
                    <Bar dataKey="Roster penalties" fill={ROSTER_COLOR} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Penalty (−pts)" fill={PENALTY_COLOR} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Secondary Penalty (−pts)" fill={SEC_PEN_COLOR} radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
            {/* Summary note */}
            <p className="text-xs text-text-muted text-center mt-2">
                {totalRoster} roster pen · {totalPts} pts deducted
                {diff !== 0 && (
                    <span className={diff > 0 ? ' text-danger' : ' text-success'}>
                        {' '}({diff > 0 ? '+' : ''}{diff} unaccounted)
                    </span>
                )}
            </p>
        </div>
    )
}
