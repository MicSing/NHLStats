import { useEffect, useState, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { HockeyIcon, WarningOctagonIcon, XIcon, ArrowSquareOutIcon } from '@phosphor-icons/react'
import type { Match } from '../../types/match'
import { CompletionType } from '../../types/match'
import type { UserMatch, UserMatchGoal, UserMatchPenalty, UserMatchPoint } from '../../types/userMatch'
import type { RosterPlayer } from '../../types/roster'
import type { Season } from '../../types/season'
import { teamLogoUrl } from '../../utils/teamLogoUrl'
import apiClient from '../../services/apiClient'
import CompletionBadge from '../CompletionBadge'
import LoadingSpinner from '../LoadingSpinner'
import { normalizeCompletionType } from './seasonUtils'

interface Props {
    match: Match | null
    seasonId: number
    roundName?: string
    gameLabel?: string
    onClose: () => void
}

export interface MatchTimelineEvent {
    id: string
    side: 'home' | 'away'
    type: 'goal' | 'penalty' | 'conceded'
    title: string
    count: number
    goalType?: 'Regular' | 'PowerPlay' | 'ShortHanded'
    userName: string
}

function isDecisive(match: Match): boolean {
    const ct = normalizeCompletionType(match.completionType)
    return ct === CompletionType.RegularTime || ct === CompletionType.Overtime || ct === CompletionType.Shootout
}

export default function PlayoffMatchModal({ match, seasonId, roundName, gameLabel, onClose }: Props) {
    const { t } = useTranslation()
    const titleId = useId()
    const [loading, setLoading] = useState(false)
    const [events, setEvents] = useState<MatchTimelineEvent[]>([])

    useEffect(() => {
        if (!match) return

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [match, onClose])

    useEffect(() => {
        if (!match || !seasonId) return

        let cancelled = false
        setLoading(true)
        setEvents([])

        Promise.all([
            apiClient.get<UserMatch[]>(`/api/seasons/${seasonId}/matches/${match.id}/usermatches`).catch(() => []),
            apiClient.get<RosterPlayer[]>(`/api/seasons/${seasonId}/roster`).catch(() => []),
            apiClient.get<Season>(`/api/seasons/${seasonId}`).catch(() => null),
        ])
            .then(async ([userMatches, roster, season]) => {
                if (cancelled) return

                const timeline: MatchTimelineEvent[] = []

                const getSideForRosterPlayer = (rosterPlayerId: number): 'home' | 'away' => {
                    const rp = roster.find((r) => r.id === rosterPlayerId)
                    if (rp && rp.teamId) {
                        if (rp.teamId === match.homeTeamId) return 'home'
                        if (rp.teamId === match.awayTeamId) return 'away'
                    }
                    if (season && season.hostedTeamId) {
                        if (season.hostedTeamId === match.homeTeamId) return 'home'
                        if (season.hostedTeamId === match.awayTeamId) return 'away'
                    }
                    return 'home'
                }

                await Promise.all(
                    userMatches.map(async (um) => {
                        const [userGoals, userPenalties, userPoints] = await Promise.all([
                            apiClient.get<UserMatchGoal[]>(`/api/usermatches/${um.id}/goals`).catch(() => []),
                            apiClient.get<UserMatchPenalty[]>(`/api/usermatches/${um.id}/penalties`).catch(() => []),
                            apiClient.get<UserMatchPoint[]>(`/api/usermatches/${um.id}/points`).catch(() => []),
                        ])
                        const userName = um.userName ?? `User ${um.userId}`

                        // Process Goals
                        for (const g of userGoals) {
                            const side = getSideForRosterPlayer(g.rosterPlayerId)
                            const playerName =
                                `${g.playerFirstName ?? ''} ${g.playerSurname ?? ''}`.trim() || t('common.player')
                            timeline.push({
                                id: `goal-${g.id}`,
                                side,
                                type: 'goal',
                                title: playerName,
                                count: g.count,
                                goalType: g.goalType,
                                userName,
                            })
                        }

                        // Process Penalties
                        for (const p of userPenalties) {
                            const side = getSideForRosterPlayer(p.rosterPlayerId)
                            const playerName =
                                `${p.playerFirstName ?? ''} ${p.playerSurname ?? ''}`.trim() || t('common.player')
                            timeline.push({
                                id: `penalty-${p.id}`,
                                side,
                                type: 'penalty',
                                title: playerName,
                                count: p.count,
                                userName,
                            })
                        }

                        // Process Conceded goals / Opponent Negative Points (e.g. Own Goal, Error in Defense)
                        for (const pt of userPoints) {
                            if (pt.pointType === 'Negative' && pt.pointReasonName) {
                                const isConcededReason =
                                    pt.pointReasonName.toLowerCase().includes('goal') ||
                                    pt.pointReasonName.toLowerCase().includes('defense') ||
                                    pt.pointReasonName.toLowerCase().includes('gól') ||
                                    pt.pointReasonName.toLowerCase().includes('obrana')
                                if (isConcededReason) {
                                    // If hosted team is home, an error or own goal is for the away team
                                    const hostedIsHome = season?.hostedTeamId === match.homeTeamId
                                    const side: 'home' | 'away' = hostedIsHome ? 'away' : 'home'
                                    timeline.push({
                                        id: `conceded-${pt.id}`,
                                        side,
                                        type: 'conceded',
                                        title: pt.pointReasonName,
                                        count: pt.count,
                                        userName,
                                    })
                                }
                            }
                        }
                    })
                )

                if (!cancelled) {
                    setEvents(timeline)
                }
            })
            .catch(() => {})
            .finally(() => {
                if (!cancelled) setLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [match?.id, seasonId, t])

    if (!match) return null

    const decisive = isDecisive(match)
    const homeWon = decisive && match.homeScore > match.awayScore
    const awayWon = decisive && match.awayScore > match.homeScore
    const completionType = normalizeCompletionType(match.completionType)

    const homeLogo = teamLogoUrl(match.homeTeamShortName)
    const awayLogo = teamLogoUrl(match.awayTeamShortName)

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto"
            onClick={onClose}
        >
            <div
                className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col my-auto max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-bg/40">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full">
                            {gameLabel || t('match.matchNumber', { number: match.matchNumber })}
                        </span>
                        {roundName && (
                            <span className="text-xs font-semibold text-text-muted truncate">
                                {roundName}
                            </span>
                        )}
                        {match.matchDate && (
                            <span className="text-xs text-text-muted hidden sm:inline">
                                • {new Date(match.matchDate).toLocaleDateString()}
                            </span>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={t('common.close')}
                        className="text-text-muted hover:text-text p-1.5 rounded-lg hover:bg-bg/60 transition-colors"
                    >
                        <XIcon size={18} />
                    </button>
                </div>

                {/* Scoreboard Hero Banner (Clean, no trophy or "Winner" badge) */}
                <div className="p-5 sm:p-6 bg-gradient-to-b from-bg/60 to-surface border-b border-border">
                    <div className="grid grid-cols-7 items-center gap-3">
                        {/* Home Team */}
                        <div className={`col-span-3 flex items-center gap-3 ${homeWon ? '' : awayWon ? 'opacity-65' : ''}`}>
                            <img
                                src={homeLogo}
                                alt={match.homeTeamShortName ?? ''}
                                className="w-12 h-12 sm:w-14 sm:h-14 object-contain flex-shrink-0"
                                onError={(e) => { ;(e.target as HTMLImageElement).style.display = 'none' }}
                            />
                            <div className="min-w-0">
                                <h2 id={titleId} className={`font-bold text-base sm:text-lg truncate ${homeWon ? 'text-text font-black' : 'text-text-muted font-medium'}`}>
                                    {match.homeTeamShortName || match.homeTeamName}
                                </h2>
                                <p className="text-xs text-text-muted truncate hidden sm:block">
                                    {match.homeTeamName}
                                </p>
                            </div>
                        </div>

                        {/* Score Display */}
                        <div className="col-span-1 flex flex-col items-center justify-center">
                            <div className="flex items-center gap-1.5 text-2xl sm:text-3xl font-black tabular-nums tracking-tight">
                                <span className={homeWon ? 'text-primary font-black' : 'text-text'}>{match.homeScore}</span>
                                <span className="text-text-muted text-base sm:text-xl font-normal">:</span>
                                <span className={awayWon ? 'text-primary font-black' : 'text-text'}>{match.awayScore}</span>
                            </div>
                            <div className="mt-1">
                                {completionType !== CompletionType.None ? (
                                    <CompletionBadge type={completionType} />
                                ) : (
                                    <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">
                                        {t('match.notPlayed')}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Away Team */}
                        <div className={`col-span-3 flex items-center justify-end gap-3 text-right ${awayWon ? '' : homeWon ? 'opacity-65' : ''}`}>
                            <div className="min-w-0">
                                <h2 className={`font-bold text-base sm:text-lg truncate ${awayWon ? 'text-text font-black' : 'text-text-muted font-medium'}`}>
                                    {match.awayTeamShortName || match.awayTeamName}
                                </h2>
                                <p className="text-xs text-text-muted truncate hidden sm:block">
                                    {match.awayTeamName}
                                </p>
                            </div>
                            <img
                                src={awayLogo}
                                alt={match.awayTeamShortName ?? ''}
                                className="w-12 h-12 sm:w-14 sm:h-14 object-contain flex-shrink-0"
                                onError={(e) => { ;(e.target as HTMLImageElement).style.display = 'none' }}
                            />
                        </div>
                    </div>
                </div>

                {/* Team Label Sub-header for Event History */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center px-5 py-2.5 bg-bg/50 border-b border-border text-xs font-bold text-text-muted uppercase tracking-wider">
                    <div className="flex items-center gap-2 min-w-0">
                        <img src={homeLogo} alt="" className="w-4 h-4 object-contain" />
                        <span className="truncate">{match.homeTeamShortName || match.homeTeamName}</span>
                    </div>
                    <span className="text-[10px] text-text-muted/80 font-bold px-2">
                        {t('season.playoffEventHistory')}
                    </span>
                    <div className="flex items-center justify-end gap-2 min-w-0 text-right">
                        <span className="truncate">{match.awayTeamShortName || match.awayTeamName}</span>
                        <img src={awayLogo} alt="" className="w-4 h-4 object-contain" />
                    </div>
                </div>

                {/* Event History / Timeline (Goal on one side, goal on the other side) */}
                <div className="p-4 sm:p-6 overflow-y-auto flex-1">
                    {loading ? (
                        <div className="py-8">
                            <LoadingSpinner />
                        </div>
                    ) : events.length === 0 ? (
                        <p className="text-xs text-text-muted italic py-8 text-center">
                            {t('season.playoffNoEvents')}
                        </p>
                    ) : (
                        <div className="relative space-y-4">
                            {/* Central timeline line */}
                            <div
                                className="absolute left-1/2 -translate-x-1/2 top-2 bottom-2 w-0.5 bg-border/60 pointer-events-none"
                                aria-hidden="true"
                            />

                            {events.map((ev) => {
                                const isHome = ev.side === 'home'
                                const isGoal = ev.type === 'goal' || ev.type === 'conceded'

                                return (
                                    <div
                                        key={ev.id}
                                        className="relative grid grid-cols-[1fr_28px_1fr] items-center gap-2 text-xs"
                                    >
                                        {/* Left Side (Home) */}
                                        <div className="flex justify-end min-w-0">
                                            {isHome ? (
                                                <div className="bg-surface border border-border/80 rounded-lg p-2.5 max-w-[260px] w-full text-right shadow-sm flex flex-col items-end">
                                                    <div className="flex items-center justify-end gap-1.5 font-bold text-text">
                                                        <span>{ev.title}</span>
                                                        {ev.count > 1 && (
                                                            <span className="text-[11px] font-mono font-bold text-primary">
                                                                ×{ev.count}
                                                            </span>
                                                        )}
                                                        {ev.goalType === 'PowerPlay' && (
                                                            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                                                PP
                                                            </span>
                                                        )}
                                                        {ev.goalType === 'ShortHanded' && (
                                                            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                                                SH
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] text-text-muted truncate mt-0.5">
                                                        {ev.userName}
                                                    </span>
                                                </div>
                                            ) : null}
                                        </div>

                                        {/* Center Axis Node */}
                                        <div className="relative flex items-center justify-center z-10">
                                            <div
                                                className={`w-6 h-6 rounded-full flex items-center justify-center shadow-sm border ${
                                                    isGoal
                                                        ? 'bg-primary/20 text-primary border-primary/40'
                                                        : 'bg-danger/20 text-danger border-danger/40'
                                                }`}
                                            >
                                                {isGoal ? (
                                                    <HockeyIcon size={13} />
                                                ) : (
                                                    <WarningOctagonIcon size={13} />
                                                )}
                                            </div>
                                        </div>

                                        {/* Right Side (Away) */}
                                        <div className="flex justify-start min-w-0">
                                            {!isHome ? (
                                                <div className="bg-surface border border-border/80 rounded-lg p-2.5 max-w-[260px] w-full text-left shadow-sm flex flex-col items-start">
                                                    <div className="flex items-center gap-1.5 font-bold text-text">
                                                        <span>{ev.title}</span>
                                                        {ev.count > 1 && (
                                                            <span className="text-[11px] font-mono font-bold text-primary">
                                                                ×{ev.count}
                                                            </span>
                                                        )}
                                                        {ev.goalType === 'PowerPlay' && (
                                                            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                                                PP
                                                            </span>
                                                        )}
                                                        {ev.goalType === 'ShortHanded' && (
                                                            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                                                SH
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] text-text-muted truncate mt-0.5">
                                                        {ev.userName}
                                                    </span>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-bg/40 text-xs">
                    <Link
                        to={`/seasons/${seasonId}/matches/${match.id}`}
                        className="text-primary hover:text-primary-hover font-semibold flex items-center gap-1.5 transition-colors"
                    >
                        <span>{t('season.playoffGoToMatch')}</span>
                        <ArrowSquareOutIcon size={14} />
                    </Link>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1.5 rounded-lg bg-surface hover:bg-border text-text font-medium border border-border transition-colors"
                    >
                        {t('common.close')}
                    </button>
                </div>
            </div>
        </div>
    )
}
