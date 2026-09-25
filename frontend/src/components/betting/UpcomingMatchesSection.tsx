import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { FutureMatch } from '../../types/match'
import MatchupModal from './MatchupModal'

interface UpcomingMatchesSectionProps {
    matches: FutureMatch[]
    selectedMatchId: number | null
    onSelect: (id: number) => void
}

export default function UpcomingMatchesSection({ matches, selectedMatchId, onSelect }: UpcomingMatchesSectionProps) {
    const { t } = useTranslation()
    const [matchupMatch, setMatchupMatch] = useState<FutureMatch | null>(null)
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
                            <div
                                key={m.id}
                                className={`relative rounded border transition-colors ${
                                    active
                                        ? 'border-primary bg-primary/10'
                                        : 'border-border bg-bg hover:bg-surface'
                                }`}
                            >
                                <button
                                    onClick={() => onSelect(m.id)}
                                    className="w-full text-left px-3 py-2"
                                >
                                    <p className="text-[10px] font-mono text-text-muted uppercase pr-6">
                                        {t('betting.matchNumber', { number: m.matchNumber })}
                                    </p>
                                    <p className="flex items-center gap-1.5 text-xs font-semibold leading-tight mt-0.5">
                                        <span className="shrink-0 text-[9px] font-bold uppercase px-1 rounded bg-primary/15 text-primary">
                                            {t('betting.homeBadge')}
                                        </span>
                                        <span className="truncate">{m.homeTeamName ?? t('betting.unknownTeam')}</span>
                                    </p>
                                    <p className="flex items-center gap-1.5 text-xs font-semibold leading-tight mt-0.5">
                                        <span className="shrink-0 text-[9px] font-bold uppercase px-1 rounded bg-border text-text-muted">
                                            {t('betting.awayBadge')}
                                        </span>
                                        <span className="truncate">{m.awayTeamName ?? t('betting.unknownTeam')}</span>
                                    </p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMatchupMatch(m)}
                                    aria-label={t('betting.matchupOpen', { number: m.matchNumber })}
                                    title={t('betting.matchupTitle')}
                                    className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded-full border border-border bg-bg-secondary text-[10px] font-bold text-text-muted hover:text-primary hover:border-primary/40 transition-colors"
                                >
                                    i
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}
            {matchupMatch && <MatchupModal match={matchupMatch} onClose={() => setMatchupMatch(null)} />}
        </section>
    )
}
