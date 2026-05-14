import { useTranslation } from 'react-i18next'
import type { FutureMatch } from '../../types/match'

interface UpcomingMatchesSectionProps {
    matches: FutureMatch[]
    selectedMatchId: number | null
    onSelect: (id: number) => void
}

export default function UpcomingMatchesSection({ matches, selectedMatchId, onSelect }: UpcomingMatchesSectionProps) {
    const { t } = useTranslation()
    return (
        <section className="card p-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted mb-3">
                {t('betting.upcomingMatches')}
            </h2>
            {matches.length === 0 ? (
                <p className="text-text-muted text-sm">{t('betting.noMatches')}</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2">
                    {matches.map((m) => {
                        const active = m.id === selectedMatchId
                        return (
                            <button
                                key={m.id}
                                onClick={() => onSelect(m.id)}
                                className={`text-left px-3 py-2 rounded border transition-colors ${
                                    active
                                        ? 'border-primary bg-primary/10'
                                        : 'border-border bg-bg hover:bg-surface'
                                }`}
                            >
                                <p className="text-[10px] font-mono text-text-muted uppercase">
                                    {t('betting.matchNumber', { number: m.matchNumber })}
                                </p>
                                <p className="text-xs font-semibold leading-tight mt-0.5">
                                    {m.homeTeamName ?? t('betting.unknownTeam')}
                                </p>
                                <p className="text-xs font-semibold leading-tight">
                                    {m.awayTeamName ?? t('betting.unknownTeam')}
                                </p>
                            </button>
                        )
                    })}
                </div>
            )}
        </section>
    )
}
