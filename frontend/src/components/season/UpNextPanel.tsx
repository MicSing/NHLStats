import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { Match } from '../../types/match'
import type { Season } from '../../types/season'
import type { WeekGroup, HeadToHeadMatch } from '../../types/stats'
import { CompletionType } from '../../types/match'
import { teamLogoUrl } from '../../utils/teamLogoUrl'
import CompletionBadge from '../CompletionBadge'
import { normalizeCompletionType } from './seasonUtils'

interface Props {
    allMatches: Match[]
    weekGroups: WeekGroup[]
    seasonId: number
    seasons: Season[]
    loadingH2H: boolean
    h2hMatches: HeadToHeadMatch[]
    h2hExpanded: boolean
    onToggleH2H: () => void
}

export default function UpNextPanel({
    allMatches,
    weekGroups,
    seasonId,
    seasons,
    loadingH2H,
    h2hMatches,
    h2hExpanded,
    onToggleH2H,
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

    const teamShortNameById = new Map<number, string>()
    for (const group of weekGroups) {
        for (const wm of group.matches) {
            if (wm.homeTeamShortName) teamShortNameById.set(wm.homeTeamId, wm.homeTeamShortName)
            if (wm.awayTeamShortName) teamShortNameById.set(wm.awayTeamId, wm.awayTeamShortName)
        }
    }

    const homeShort = teamShortNameById.get(upNext.homeTeamId) ?? null
    const awayShort = teamShortNameById.get(upNext.awayTeamId) ?? null
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

                {/* Match number + H2H toggle */}
                <div className="flex items-center justify-between mb-6 relative z-10">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider bg-bg px-2 py-1 rounded border border-border">
                        {t('season.match', { number: upNext.matchNumber })}
                    </span>
                    {hostedTeamId && !loadingH2H && h2hMatches.length > 0 && (
                        <button
                            type="button"
                            onClick={onToggleH2H}
                            className="text-[11px] text-primary hover:text-primary-hover font-bold transition-colors uppercase tracking-wider"
                        >
                            {h2hExpanded
                                ? t('season.hide')
                                : t('season.showMatches', { count: h2hMatches.length })}
                        </button>
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

                {/* H2H section */}
                {hostedTeamId && (
                    <div className="mt-6 relative z-10">
                        {loadingH2H && (
                            <div className="flex items-center gap-2 text-text-muted text-sm py-2">
                                <svg className="animate-spin w-4 h-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                <span>{t('common.loading')}</span>
                            </div>
                        )}
                        {!loadingH2H && h2hMatches.length === 0 && (
                            <p className="text-sm text-text-muted py-2">{t('common.noData')}</p>
                        )}
                        {!loadingH2H && h2hMatches.length > 0 && h2hExpanded && (
                            <div className="border-t border-border pt-4">
                                <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">
                                    {t('season.previousMeetings')}
                                </h4>
                                <div className="space-y-1.5">
                                    {h2hMatches.map((h2hMatch: HeadToHeadMatch) => {
                                        const ct = normalizeCompletionType(h2hMatch.completionType)
                                        const h2hHomeLogo = teamLogoUrl(h2hMatch.homeTeamShortName)
                                        const h2hAwayLogo = teamLogoUrl(h2hMatch.awayTeamShortName)
                                        return (
                                            <div key={h2hMatch.matchId} className="flex justify-between items-center bg-bg/50 border border-border rounded p-2 text-xs">
                                                <span className="text-text-muted font-medium whitespace-nowrap">
                                                    {new Date(h2hMatch.matchDate).toLocaleDateString()} · {h2hMatch.seasonName}
                                                </span>
                                                <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                                                    <img
                                                        src={h2hHomeLogo}
                                                        alt={h2hMatch.homeTeamShortName}
                                                        className="w-4 h-4 object-contain"
                                                        onError={(e) => { ;(e.target as HTMLImageElement).style.display = 'none' }}
                                                    />
                                                    <span className="font-bold tabular-nums">
                                                        {h2hMatch.homeScore}–{h2hMatch.awayScore}
                                                    </span>
                                                    <img
                                                        src={h2hAwayLogo}
                                                        alt={h2hMatch.awayTeamShortName}
                                                        className="w-4 h-4 object-contain"
                                                        onError={(e) => { ;(e.target as HTMLImageElement).style.display = 'none' }}
                                                    />
                                                    {ct !== CompletionType.None && <CompletionBadge type={ct} />}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
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
