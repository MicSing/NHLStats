import {
    ComposedChart,
    Bar,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts'
import { useTranslation } from 'react-i18next'
import type { TeamStatsMatch } from '../../types/teamStats'
import { deriveMatchResults, type MatchWithResult } from '../../utils/teamStatsRecord'
import { useChartTheme } from '../charts/useChartTheme'

interface Props {
    matches: TeamStatsMatch[]
}
interface ChartMatch extends MatchWithResult {
    matchLabel: string
    plus: number
    minus: number
    diff: number
}

function toChartData(matches: TeamStatsMatch[]): ChartMatch[] {
    const sorted = [...matches].sort((a, b) => {
        const timeDiff = new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime()
        if (timeDiff !== 0) return timeDiff
        return a.matchId - b.matchId
    })
    return deriveMatchResults(sorted).map((m, index) => ({
        ...m,
        matchLabel: `#${index + 1}`,
        plus: m.goalsFor,
        minus: -m.goalsAgainst,
        diff: m.goalsFor - m.goalsAgainst,
    }))
}

export default function TeamStatsGoalDifferentialChart({ matches }: Props) {
    const { t } = useTranslation()
    const ct = useChartTheme()
    const chartData = toChartData(matches)

    return (
        <div role="img" aria-label={t('teamStats.goalDifferentialTitle')} className="w-full">
            {chartData.length === 0 ? (
                <p className="text-text-muted text-sm text-center py-8">{t('teamStats.noMatches')}</p>
            ) : (
                <div className="h-[240px] sm:h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} stackOffset="sign" margin={ct.margin}>
                            <CartesianGrid strokeDasharray="4 4" stroke={ct.grid} />
                            <XAxis
                                xAxisId={0}
                                dataKey="matchLabel"
                                type="category"
                                allowDuplicatedCategory={false}
                                tick={{ fill: ct.tick, fontSize: 11 }}
                                tickLine={false}
                                axisLine={false}
                            />
                            <XAxis xAxisId={1} dataKey="matchLabel" type="category" allowDuplicatedCategory={false} hide />
                            <YAxis
                                tick={{ fill: ct.tick, fontSize: 12 }}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(v: number) => String(Math.abs(v))}
                                width={ct.yAxisWidthNarrow}
                            />
                            <Tooltip
                                content={({ active, payload }) => {
                                    if (!active || !payload || payload.length === 0) return null
                                    const entry = payload[0].payload as ChartMatch
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
                                            <p style={{ fontWeight: 'bold', marginBottom: 6, paddingBottom: 6, borderBottom: `1px solid ${ct.tooltipBorder}` }}>
                                                Match {entry.matchLabel} · {entry.seasonName}
                                            </p>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '2px' }}>
                                                <span>{t('teamStats.goalsFor', 'Goals For')}:</span>
                                                <span style={{ fontWeight: 'bold' }}>{entry.goalsFor}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '6px' }}>
                                                <span>{t('teamStats.goalsAgainst', 'Goals Against')}:</span>
                                                <span style={{ fontWeight: 'bold' }}>{entry.goalsAgainst}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', color: entry.diff > 0 ? '#10B981' : entry.diff < 0 ? '#EF4444' : ct.tooltipText }}>
                                                <span>{t('teamStats.differential', 'Differential')}:</span>
                                                <span style={{ fontWeight: 'bold' }}>{entry.diff > 0 ? '+' : ''}{entry.diff}</span>
                                            </div>
                                            <p style={{ fontWeight: 'bold', marginTop: 8, paddingTop: 6, borderTop: `1px solid ${ct.tooltipBorder}`, textAlign: 'center' }}>
                                                {t(`teamStats.result${entry.result}`)}
                                            </p>
                                        </div>
                                    )
                                }}
                            />
                            <Legend wrapperStyle={{ color: ct.legendText }} />
                            {/* Lighter bars for total goals */}
                            <Bar xAxisId={0} dataKey="plus" name={t('teamStats.goalsFor', 'Goals For')} stackId="a" fill="#10B981" fillOpacity={0.2} radius={[4, 4, 0, 0]} barSize={24} />
                            <Bar xAxisId={0} dataKey="minus" name={t('teamStats.goalsAgainst', 'Goals Against')} stackId="a" fill="#EF4444" fillOpacity={0.2} radius={[4, 4, 0, 0]} barSize={24} />
                            
                            {/* Solid bold bar for differential, placed perfectly inside using secondary XAxis */}
                            <Bar xAxisId={1} dataKey="diff" name={t('teamStats.differential', 'Differential')} barSize={24} radius={[4, 4, 4, 4]}>
                                {chartData.map((entry) => (
                                    <Cell key={`cell-${entry.matchId}`} fill={entry.diff > 0 ? '#10B981' : entry.diff < 0 ? '#EF4444' : '#6B7280'} />
                                ))}
                            </Bar>
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    )
}
