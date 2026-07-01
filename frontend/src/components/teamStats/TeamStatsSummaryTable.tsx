import { useTranslation } from 'react-i18next'
import type { TeamStatsLeader, TeamStatsSummary } from '../../types/teamStats'

interface Props {
    summary: TeamStatsSummary
}

export default function TeamStatsSummaryTable({ summary }: Props) {
    const { t } = useTranslation()

    function renderLeader(leader: TeamStatsLeader | null, pairedLabel: string) {
        if (!leader) return <span className="text-text-muted">—</span>
        return (
            <>
                <span className="font-semibold">{leader.name}</span>{' '}
                <span className="text-text-muted tabular-nums">({leader.count})</span>
                {leader.pairedContributors.length > 0 && (
                    <span className="block text-xs text-text-muted mt-0.5">
                        {pairedLabel}: {leader.pairedContributors.map((c) => `${c.name} (${c.count})`).join(', ')}
                    </span>
                )}
            </>
        )
    }

    function formatAvg(value: number) {
        return value.toFixed(2)
    }

    const rows: { label: string; value: React.ReactNode }[] = [
        { label: t('teamStats.topScoringUser'), value: renderLeader(summary.topScoringUser, t('teamStats.withPlayer')) },
        { label: t('teamStats.topScoringPlayer'), value: renderLeader(summary.topScoringPlayer, t('teamStats.withUser')) },
        { label: t('teamStats.topPenalizedUser'), value: renderLeader(summary.topPenalizedUser, t('teamStats.withPlayer')) },
        { label: t('teamStats.topPenalizedPlayer'), value: renderLeader(summary.topPenalizedPlayer, t('teamStats.withUser')) },
        { label: t('teamStats.topPlusUser'), value: renderLeader(summary.topPlusUser, t('teamStats.withPlayer')) },
        { label: t('teamStats.topMinusUser'), value: renderLeader(summary.topMinusUser, t('teamStats.withPlayer')) },
        {
            label: t('teamStats.totalPlusPoints'),
            value: <span className="text-success font-bold tabular-nums">+{summary.totalPlusPoints}</span>,
        },
        {
            label: t('teamStats.totalMinusPoints'),
            value: <span className="text-danger font-bold tabular-nums">−{summary.totalMinusPoints}</span>,
        },
        {
            label: t('teamStats.avgPlusPerMatch'),
            value: <span className="text-success font-bold tabular-nums">{formatAvg(summary.avgPlusPerMatch)}</span>,
        },
        {
            label: t('teamStats.avgMinusPerMatch'),
            value: <span className="text-danger font-bold tabular-nums">{formatAvg(summary.avgMinusPerMatch)}</span>,
        },
        {
            label: t('teamStats.avgGoalsPerMatch'),
            value: <span className="font-bold tabular-nums text-text">{formatAvg(summary.avgGoalsPerMatch)}</span>,
        },
        {
            label: t('teamStats.avgPenaltiesPerMatch'),
            value: <span className="font-bold tabular-nums text-text-muted">{formatAvg(summary.avgPenaltiesPerMatch)}</span>,
        },
    ]

    return (
        <section className="mb-8" aria-label="Team stats">
            <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted mb-3">
                {t('teamStats.summaryTitle')}
            </h2>
            <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-card">
                <table className="w-full text-sm">
                    <thead className="bg-bg border-b border-border text-[11px] uppercase tracking-wider text-text-muted">
                        <tr>
                            <th className="py-2.5 px-3 sm:py-3 sm:px-5 font-semibold text-left">{t('teamStats.statLabel')}</th>
                            <th className="py-2.5 px-3 sm:py-3 sm:px-5 font-semibold text-left">{t('teamStats.statValue')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {rows.map((row) => (
                            <tr key={row.label} className="hover:bg-bg/60 transition-colors">
                                <td className="py-2.5 px-3 sm:py-3 sm:px-5 font-medium text-text-muted">{row.label}</td>
                                <td className="py-2.5 px-3 sm:py-3 sm:px-5">{row.value}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    )
}
