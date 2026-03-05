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
import type { PointReasonBreakdownItem } from '../../types/stats'
import { useChartTheme } from './useChartTheme'
import { useTranslation } from 'react-i18next'

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
    const ct = useChartTheme()
    const { t } = useTranslation()
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
                <p className="text-text-muted text-sm">{t('userStats.noData')}</p>
            </div>
        )
    }

    // Single grouped bar chart — one "category" with 3 bars side by side
    const rosterLabel = t('penaltyChart.rosterPenalties')
    const penaltyLabel = t('penaltyChart.penaltyPts')
    const secPenaltyLabel = t('penaltyChart.secPenaltyPts')

    const chartData = [
        {
            label: t('userStats.penalties'),
            [rosterLabel]: totalRoster,
            [penaltyLabel]: penaltyPts,
            [secPenaltyLabel]: secPenaltyPts,
        },
    ]

    return (
        <div role="img" aria-label="penalty chart" className="w-full">
            <ResponsiveContainer width="100%" height={240}>
                <BarChart
                    data={chartData}
                    margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                    barCategoryGap="30%"
                    barGap={4}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                    <XAxis dataKey="label" tick={{ fill: ct.tick, fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fill: ct.tick, fontSize: 12 }} />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: ct.tooltipBg,
                            border: `1px solid ${ct.tooltipBorder}`,
                            color: ct.tooltipText,
                        }}
                    />
                    <Legend wrapperStyle={{ color: ct.legendText, fontSize: 12 }} />
                    <Bar dataKey={rosterLabel} fill={ROSTER_COLOR} radius={[4, 4, 0, 0]} />
                    <Bar dataKey={penaltyLabel} fill={PENALTY_COLOR} radius={[4, 4, 0, 0]} />
                    <Bar dataKey={secPenaltyLabel} fill={SEC_PEN_COLOR} radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
            {/* Summary note */}
            <p className="text-xs text-text-muted text-center mt-2">
                {t('userStats.penaltyChartSummary', { roster: totalRoster, pen: penaltyPts, secPen: secPenaltyPts })}
                {totalRoster > 0 && (
                    <>
                        {' '}—{' '}
                        <span className="text-danger">
                            {t('userStats.penaltyChartChance', { pct: Math.round(penaltyPts / totalRoster * 100) })}
                        </span>
                        {secPenaltyPts > 0 && (
                            <span className="text-warning">
                                {' '}{t('userStats.penaltyChartExtra', { pct: Math.round(secPenaltyPts / totalRoster * 100) })}
                            </span>
                        )}
                    </>
                )}
            </p>
        </div>
    )
}
