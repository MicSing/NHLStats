import { StarIcon, LightningIcon, ShieldIcon, WarningOctagonIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import type { TopRosterPlayer } from '../../types/stats'

interface Props {
    topScorer: TopRosterPlayer | null
    topPenalized: TopRosterPlayer | null
    topPpScorer: TopRosterPlayer | null
    topShScorer: TopRosterPlayer | null
}

export default function TopPlayersGrid({ topScorer, topPenalized, topPpScorer, topShScorer }: Props) {
    const { t } = useTranslation()

    if (!topScorer && !topPenalized && !topPpScorer && !topShScorer) return null

    return (
        <section className="mb-8 grid grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Top players">
            {topScorer && (
                <div className="bg-surface border border-border rounded-lg p-5 flex flex-col justify-between shadow-card relative overflow-hidden group">
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                        <StarIcon size={96} weight="fill" />
                    </div>
                    <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-4 relative z-10">{t('season.topScorer')}</h3>
                    <p className="text-base font-bold leading-tight mb-2 relative z-10">
                        {topScorer.firstName} {topScorer.surname}
                    </p>
                    <div className="text-sm font-semibold text-primary relative z-10">
                        {t('season.goals_count', { count: topScorer.count })}
                    </div>
                </div>
            )}
            {topPpScorer && (
                <div className="bg-surface border border-border rounded-lg p-5 flex flex-col justify-between shadow-card relative overflow-hidden group">
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                        <LightningIcon size={96} weight="fill" />
                    </div>
                    <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-4 relative z-10">{t('season.topPowerPlayScorer')}</h3>
                    <p className="text-base font-bold leading-tight mb-2 relative z-10">
                        {topPpScorer.firstName} {topPpScorer.surname}
                    </p>
                    <div className="text-sm font-semibold text-primary relative z-10">
                        {t('season.goals_count', { count: topPpScorer.count })}
                    </div>
                </div>
            )}
            {topShScorer && (
                <div className="bg-surface border border-border rounded-lg p-5 flex flex-col justify-between shadow-card relative overflow-hidden group">
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                        <ShieldIcon size={96} weight="fill" />
                    </div>
                    <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-4 relative z-10">{t('season.topShortHandedScorer')}</h3>
                    <p className="text-base font-bold leading-tight mb-2 relative z-10">
                        {topShScorer.firstName} {topShScorer.surname}
                    </p>
                    <div className="text-sm font-semibold text-primary relative z-10">
                        {t('season.goals_count', { count: topShScorer.count })}
                    </div>
                </div>
            )}
            {topPenalized && (
                <div className="bg-surface border border-border rounded-lg p-5 flex flex-col justify-between shadow-card relative overflow-hidden group">
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none text-danger">
                        <WarningOctagonIcon size={96} weight="fill" />
                    </div>
                    <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-4 relative z-10">{t('season.mostPenalized')}</h3>
                    <p className="text-base font-bold leading-tight mb-2 relative z-10">
                        {topPenalized.firstName} {topPenalized.surname}
                    </p>
                    <div className="text-sm font-semibold text-danger relative z-10">
                        {t('season.penalties_count', { count: topPenalized.count })}
                    </div>
                </div>
            )}
        </section>
    )
}
