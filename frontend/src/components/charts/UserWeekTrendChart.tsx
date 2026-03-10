import { useState } from 'react'
import {
    ComposedChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts'
import type { SeasonMatchHistory } from '../../types/stats'
import { useChartTheme } from './useChartTheme'
import { useTranslation } from 'react-i18next'

const WEEK_OPTIONS = [4, 8, 12, 16] as const
type WeekOption = typeof WEEK_OPTIONS[number] | 'all'

interface Props {
    seasons: SeasonMatchHistory[]
}

function abbreviateSeasonName(name: string): string {
    const m = name.match(/Season\s+(\d+)/i)
    return m ? `S${m[1]}` : name
}

export default function UserWeekTrendChart({ seasons }: Props) {
    const ct = useChartTheme()
    const { t } = useTranslation()
    const [weekLimit, setWeekLimit] = useState<WeekOption>(12)

    const totalMatches = seasons.reduce((sum, s) => sum + s.weeks.reduce((ws, w) => ws + w.matches.length, 0), 0)
    if (totalMatches === 0) {
        return (
            <div role="img" aria-label="user week trend chart" className="w-full flex items-center justify-center py-12">
                <p className="text-text-muted text-sm">{t('trendChart.noData')}</p>
            </div>
        )
    }

    const avgPlusLabel = t('trendChart.avgPlus')
    const avgMinusLabel = t('trendChart.avgMinus')
    const avgGoalsLabel = t('trendChart.avgGoals')

    // Data arrives pre-grouped with aggregates; flatten into chart data points
    const allChartData = seasons.flatMap((s) =>
        s.weeks.map((w) => {
            const count = w.matches.length
            const abbr = abbreviateSeasonName(s.seasonName)
            return {
                label: `${abbr} W${w.weekNumber}`,
                fullLabel: t('trendChart.seasonWeekLabel', { season: s.seasonName, week: w.weekNumber }),
                matchCount: count,
                [avgPlusLabel]: parseFloat((w.totalPlus / count).toFixed(1)),
                [avgMinusLabel]: parseFloat((w.totalMinus / count).toFixed(1)),
                [avgGoalsLabel]: parseFloat((w.goalCount / count).toFixed(1)),
                _totalPlus: w.totalPlus,
                _totalMinus: w.totalMinus,
                _totalGoals: w.goalCount,
            }
        }),
    )

    const chartData =
        weekLimit === 'all' ? allChartData : allChartData.slice(-weekLimit)

    return (
        <div role="img" aria-label="user week trend chart" className="w-full">
            {/* Week-count selector */}
            <div className="flex items-center gap-1 mb-3 flex-wrap">
                <span className="text-text-muted text-xs mr-1">{t('trendChart.show')}</span>
                {WEEK_OPTIONS.map((n) => (
                    <button
                        key={n}
                        onClick={() => setWeekLimit(n)}
                        className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${weekLimit === n
                            ? 'bg-primary text-white'
                            : 'bg-surface text-text-muted hover:text-text border border-border'
                            }`}
                    >
                        {n}w
                    </button>
                ))}
                <button
                    onClick={() => setWeekLimit('all')}
                    className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${weekLimit === 'all'
                        ? 'bg-primary text-white'
                        : 'bg-surface text-text-muted hover:text-text border border-border'
                        }`}
                >
                    {t('trendChart.all')}
                </button>
            </div>
            <ResponsiveContainer width="100%" height={300}>
                <ComposedChart
                    data={chartData}
                    margin={{ top: 10, right: 20, left: 0, bottom: 40 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                    <XAxis
                        dataKey="label"
                        tick={{ fill: ct.tick, fontSize: 11 }}
                        angle={-35}
                        textAnchor="end"
                        interval={0}
                    />
                    <YAxis
                        allowDecimals
                        tick={{ fill: ct.tick, fontSize: 12 }}
                    />
                    <Tooltip
                        content={({ active, payload, label }) => {
                            if (!active || !payload || payload.length === 0) return null
                            const entry = chartData.find((d) => d.label === label)
                            const totals: Record<string, number> = {
                                [avgPlusLabel]: entry?._totalPlus ?? 0,
                                [avgMinusLabel]: entry?._totalMinus ?? 0,
                                [avgGoalsLabel]: entry?._totalGoals ?? 0,
                            }
                            return (
                                <div
                                    style={{
                                        backgroundColor: ct.tooltipBg,
                                        border: `1px solid ${ct.tooltipBorder}`,
                                        color: ct.tooltipText,
                                        padding: '10px 14px',
                                        borderRadius: 6,
                                        fontSize: 12,
                                    }}
                                >
                                    <p style={{ marginBottom: 4, fontWeight: 'bold' }}>
                                        {entry?.fullLabel ?? label} —{' '}
                                        {t('trendChart.matchCount', { count: entry?.matchCount ?? 0 })}
                                    </p>
                                    {payload.map((p) => (
                                        <p key={p.name} style={{ color: p.color as string, margin: '2px 0' }}>
                                            {p.name}: {p.value} ({totals[p.name as string]})
                                        </p>
                                    ))}
                                </div>
                            )
                        }}
                    />
                    <Legend wrapperStyle={{ color: ct.legendText, fontSize: 12 }} />
                    <Bar dataKey={avgGoalsLabel} fill="#3b82f6" opacity={0.7} radius={[3, 3, 0, 0]} />
                    <Line
                        type="monotone"
                        dataKey={avgPlusLabel}
                        stroke="#22c55e"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#22c55e' }}
                        activeDot={{ r: 5 }}
                    />
                    <Line
                        type="monotone"
                        dataKey={avgMinusLabel}
                        stroke="#ef4444"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#ef4444' }}
                        activeDot={{ r: 5 }}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    )
}
