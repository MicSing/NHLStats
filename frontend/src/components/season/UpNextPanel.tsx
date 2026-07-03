import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { Match } from '../../types/match'
import type { Season } from '../../types/season'
import { teamLogoUrl } from '../../utils/teamLogoUrl'

interface Props {
    allMatches: Match[]
    seasonId: number
    seasons: Season[]
}

export default function UpNextPanel({
    allMatches,
    seasonId,
    seasons,
}: Props) {
    const { t } = useTranslation()

    const unplayed = allMatches
        .filter((m) => m.matchDate === null)
        .sort((a, b) => a.matchNumber - b.matchNumber)

    if (unplayed.length === 0) return null

    const upNext = unplayed[0]
    const upcoming = unplayed.slice(1)
    const season = seasons.find((s) => s.id === seasonId)
    const hostedTeamId = season?.hostedTeamId ?? null
    const opponentTeamId = hostedTeamId != null
        ? (upNext.homeTeamId === hostedTeamId ? upNext.awayTeamId : upNext.homeTeamId)
        : null

    const homeShort = upNext.homeTeamShortName
    const awayShort = upNext.awayTeamShortName
    const upNextHomeLogo = homeShort ? teamLogoUrl(homeShort) : null
    const upNextAwayLogo = awayShort ? teamLogoUrl(awayShort) : null

    return (
        <>
            <div className="flex items-center justify-between border-b border-border pb-2">
                <h2 className="text-sm font-bold uppercase tracking-wider">
                    {t('season.upNext')}
                </h2>
            </div>

            {/* Up Next card */}
            <div className="bg-surface border border-border rounded-lg p-5 shadow-card relative overflow-hidden">
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

                {/* Match number + Team Stats link */}
                <div className="flex items-center justify-between mb-6 relative z-10">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider bg-bg px-2 py-1 rounded border border-border">
                        {t('season.match', { number: upNext.matchNumber })}
                    </span>
                    {hostedTeamId != null && opponentTeamId != null && (
                        <Link
                            to={`/team-stats?hostedTeamId=${hostedTeamId}&opponentTeamId=${opponentTeamId}`}
                            className="text-[11px] text-primary hover:text-primary-hover font-bold transition-colors uppercase tracking-wider"
                        >
                            {t('season.viewTeamStats')}
                        </Link>
                    )}
                </div>

                {/* Teams */}
                <Link
                    to={`/seasons/${seasonId}/matches/${upNext.id}`}
                    className="flex items-center justify-between relative z-10 group/link"
                >
                    <div className="flex flex-col items-center gap-2 w-2/5">
                        {upNextHomeLogo ? (
                            <img
                                src={upNextHomeLogo}
                                alt={homeShort ?? ''}
                                className="w-14 h-14 object-contain"
                                onError={(e) => { ;(e.target as HTMLImageElement).style.display = 'none' }}
                            />
                        ) : (
                            <div className="w-14 h-14 rounded-full bg-bg border border-border flex items-center justify-center text-xs font-bold text-text-muted">
                                {upNext.homeTeamName?.slice(0, 3).toUpperCase()}
                            </div>
                        )}
                        <span className="text-sm font-bold text-center leading-tight">{upNext.homeTeamName}</span>
                    </div>
                    <div className="w-1/5 flex justify-center">
                        <span className="text-xs font-bold text-text-muted bg-bg px-2.5 py-1 rounded border border-border group-hover/link:border-primary/50 transition-colors">
                            {t('season.vs')}
                        </span>
                    </div>
                    <div className="flex flex-col items-center gap-2 w-2/5">
                        {upNextAwayLogo ? (
                            <img
                                src={upNextAwayLogo}
                                alt={awayShort ?? ''}
                                className="w-14 h-14 object-contain"
                                onError={(e) => { ;(e.target as HTMLImageElement).style.display = 'none' }}
                            />
                        ) : (
                            <div className="w-14 h-14 rounded-full bg-bg border border-border flex items-center justify-center text-xs font-bold text-text-muted">
                                {upNext.awayTeamName?.slice(0, 3).toUpperCase()}
                            </div>
                        )}
                        <span className="text-sm font-bold text-center leading-tight text-text-muted">{upNext.awayTeamName}</span>
                    </div>
                </Link>
            </div>

            {/* Upcoming matches list */}
            {upcoming.length > 0 && (
                <div>
                    <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-3">
                        {t('season.upcomingMatches')}
                    </h3>
                    <div className="space-y-2">
                        {upcoming.map((m) => (
                            <Link
                                key={m.id}
                                to={`/seasons/${seasonId}/matches/${m.id}`}
                                className="group flex items-center gap-3 bg-surface border border-border rounded p-2.5 hover:border-primary/50 transition-colors"
                            >
                                <span className="text-[11px] font-bold text-text-muted w-6 shrink-0 tabular-nums">
                                    #{m.matchNumber}
                                </span>
                                <span className="text-sm font-medium text-text-muted group-hover:text-text transition-colors truncate">
                                    {m.homeTeamName} {t('season.vs')} {m.awayTeamName}
                                </span>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </>
    )
}
