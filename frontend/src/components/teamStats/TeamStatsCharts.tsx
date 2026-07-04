import { useTranslation } from 'react-i18next'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from 'recharts'
import type { TeamStatsMatch, TeamOption } from '../../types/teamStats'
import { deriveMatchResults, tallyRecord } from '../../utils/teamStatsRecord'
import TeamStatsGoalDifferentialChart from './TeamStatsGoalDifferentialChart'

interface Props {
    matches: TeamStatsMatch[]
    hostedTeam: TeamOption
    opponentTeam: TeamOption
}

export default function TeamStatsCharts({ matches, hostedTeam, opponentTeam }: Props) {
    const { t } = useTranslation()

    if (matches.length === 0) return null

    // 1. Prepare data for Win/Loss Donut Chart
    const record = tallyRecord(deriveMatchResults(matches))
    const pieData = []
    
    if (record.wins > 0) pieData.push({ name: t('teamStats.wins', 'Wins'), value: record.wins, color: '#10B981' })
    if (record.otWins > 0) pieData.push({ name: t('teamStats.otWins', 'OT Wins'), value: record.otWins, color: '#34D399' })
    if (record.losses > 0) pieData.push({ name: t('teamStats.losses', 'Losses'), value: record.losses, color: '#EF4444' })
    if (record.otLosses > 0) pieData.push({ name: t('teamStats.otLosses', 'OT Losses'), value: record.otLosses, color: '#F87171' })
    if (record.ties > 0) pieData.push({ name: t('teamStats.ties', 'Ties'), value: record.ties, color: '#6B7280' })



    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 items-start">
            <section aria-label="Win Ratio" className="bg-surface border border-border rounded-lg p-6 shadow-card flex flex-col h-full">
                <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted mb-4 text-center">
                    {t('teamStats.winRatio')}
                </h2>
                <div style={{ width: '100%', height: 256 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '0.5rem', color: '#f9fafb' }}
                                itemStyle={{ color: '#f9fafb' }}
                            />
                            <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </section>

            {matches.length > 0 && (
                <section className="bg-surface rounded-lg p-6 border border-border shadow-card h-full flex flex-col">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-text-muted">{t('teamStats.goalDifferentialTitle', 'Goal Differential')}</h3>
                            <p className="text-xs text-text-muted mt-1">{t('teamStats.goalDifferentialDesc', 'Trend analysis')}</p>
                        </div>
                    </div>
                    <div className="mt-5 h-64 flex-1 min-h-[256px]">
                        <TeamStatsGoalDifferentialChart matches={matches} />
                    </div>
                </section>
            )}
        </div>
    )
}
