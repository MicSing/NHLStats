import { useTranslation } from 'react-i18next'
import type { TeamStatsMatch } from '../../types/teamStats'
import type { TeamOption } from '../../types/teamStats'
import { deriveMatchResults } from '../../utils/teamStatsRecord'
import { teamLogoUrl } from '../../utils/teamLogoUrl'

interface Props {
    matches: TeamStatsMatch[]
    hostedTeam: TeamOption | null
    opponentTeam: TeamOption | null
}

export default function TeamStatsMatchList({ matches, hostedTeam, opponentTeam }: Props) {
    const { t } = useTranslation()

    if (matches.length === 0) {
        return (
            <section aria-label="Matches">
                <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted mb-3">
                    {t('teamStats.matchesTitle')}
                </h2>
                <div className="bg-surface border border-border rounded-lg p-6 text-center text-text-muted text-sm">
                    {t('teamStats.noMatches')}
                </div>
            </section>
        )
    }

    return (
        <section aria-label="Matches">
            <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted mb-3">
                {t('teamStats.matchesTitle')}
            </h2>
            <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-card divide-y divide-border">
                {[...deriveMatchResults(matches)]
                    .sort((a, b) => {
                        const timeDiff = new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime()
                        if (timeDiff !== 0) return timeDiff
                        return b.matchId - a.matchId
                    })
                    .map((m, index, arr) => {
                    const matchIndex = arr.length - index // #10, #9, #8...
                    const homeTeam = m.isHome ? hostedTeam : opponentTeam
                    const awayTeam = m.isHome ? opponentTeam : hostedTeam
                    return (
                        <div key={m.matchId} className="flex items-center justify-between px-4 py-3 gap-3">
                            <div className="flex flex-col w-20">
                                <span className="text-xs text-text-muted font-semibold">Match #{matchIndex}</span>
                                <span className="text-xs text-text-muted opacity-80">{m.seasonName}</span>
                            </div>
                            <div className="flex flex-col w-20 items-end">
                                <span className="text-xs text-text-muted">
                                    {new Date(m.matchDate).toLocaleDateString()}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 flex-1 justify-center">
                                {homeTeam && (
                                    <img
                                        src={teamLogoUrl(homeTeam.shortName)}
                                        alt={homeTeam.name}
                                        className="w-6 h-6 object-contain"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                                    />
                                )}
                                <span className="font-bold tabular-nums text-text">
                                    {m.homeScore} – {m.awayScore}
                                </span>
                                {awayTeam && (
                                    <img
                                        src={teamLogoUrl(awayTeam.shortName)}
                                        alt={awayTeam.name}
                                        className="w-6 h-6 object-contain"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                                    />
                                )}
                            </div>
                            <div className="flex flex-col items-end gap-1 w-20">
                                <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
                                    {m.isHome ? t('teamStats.home') : t('teamStats.away')}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    m.result === 'W' || m.result === 'OTW' ? 'bg-success/10 text-success' :
                                    m.result === 'L' || m.result === 'OTL' ? 'bg-danger/10 text-danger' :
                                    'bg-text-muted/10 text-text-muted'
                                }`}>
                                    {t(`teamStats.result${m.result}`, m.result)}
                                </span>
                            </div>
                        </div>
                    )
                })}
            </div>
        </section>
    )
}
