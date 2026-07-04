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
            <div className="flex flex-col h-full justify-end">
                <div>
                    <span className="font-bold text-lg text-text">{leader.name}</span>{' '}
                    <span className="text-text-muted tabular-nums font-semibold">({leader.count})</span>
                </div>
                {leader.pairedContributors.length > 0 && (
                    <div className="text-[11px] text-text-muted mt-2 border-t border-border/50 pt-2 leading-tight">
                        <span className="uppercase tracking-wider opacity-70 block mb-0.5">{pairedLabel}</span>
                        {leader.pairedContributors.map((c) => `${c.name} (${c.count})`).join(', ')}
                    </div>
                )}
            </div>
        )
    }

    const rows: { label: string; value: React.ReactNode }[] = [
        { label: t('teamStats.topScoringUser'), value: renderLeader(summary.topScoringUser, t('teamStats.withPlayer')) },
        { label: t('teamStats.topScoringPlayer'), value: renderLeader(summary.topScoringPlayer, t('teamStats.withUser')) },
        { label: t('teamStats.topPenalizedUser'), value: renderLeader(summary.topPenalizedUser, t('teamStats.withPlayer')) },
        { label: t('teamStats.topPenalizedPlayer'), value: renderLeader(summary.topPenalizedPlayer, t('teamStats.withUser')) },
        { label: t('teamStats.topPlusUser'), value: renderLeader(summary.topPlusUser, t('teamStats.withPlayer')) },
        { label: t('teamStats.topMinusUser'), value: renderLeader(summary.topMinusUser, t('teamStats.withPlayer')) },
    ]

    return (
        <section className="mb-8" aria-label="Team stats">
            <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted mb-3">
                {t('teamStats.summaryTitle')}
            </h2>
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                {rows.map((row) => (
                    <div key={row.label} className="bg-surface border border-border rounded-lg p-4 shadow-card flex flex-col h-full">
                        <span className="text-[11px] text-text-muted uppercase tracking-wider mb-2 font-bold leading-tight">
                            {row.label}
                        </span>
                        <div className="flex-1 flex flex-col justify-end">
                            {row.value}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    )
}
