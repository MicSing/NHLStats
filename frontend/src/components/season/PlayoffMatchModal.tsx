import { useEffect, useState, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { TrophyIcon, HockeyIcon, WarningOctagonIcon, XIcon, ArrowSquareOutIcon } from '@phosphor-icons/react'
import type { Match } from '../../types/match'
import { CompletionType } from '../../types/match'
import type { UserMatch, UserMatchGoal, UserMatchPenalty } from '../../types/userMatch'
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

interface EnrichedEvent<T> {
    event: T
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
    const [goals, setGoals] = useState<EnrichedEvent<UserMatchGoal>[]>([])
    const [penalties, setPenalties] = useState<EnrichedEvent<UserMatchPenalty>[]>([])

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
        setGoals([])
        setPenalties([])

        apiClient
            .get<UserMatch[]>(`/api/seasons/${seasonId}/matches/${match.id}/usermatches`)
            .then(async (userMatches) => {
                if (cancelled) return

                const allGoals: EnrichedEvent<UserMatchGoal>[] = []
                const allPenalties: EnrichedEvent<UserMatchPenalty>[] = []

                await Promise.all(
                    userMatches.map(async (um) => {
                        const [userGoals, userPenalties] = await Promise.all([
                            apiClient.get<UserMatchGoal[]>(`/api/usermatches/${um.id}/goals`).catch(() => []),
                            apiClient.get<UserMatchPenalty[]>(`/api/usermatches/${um.id}/penalties`).catch(() => []),
                        ])
                        const userName = um.userName ?? `User ${um.userId}`
                        for (const g of userGoals) {
                            allGoals.push({ event: g, userName })
                        }
                        for (const p of userPenalties) {
                            allPenalties.push({ event: p, userName })
                        }
                    })
                )

                if (!cancelled) {
                    setGoals(allGoals)
                    setPenalties(allPenalties)
                }
            })
            .catch(() => {
                // Silently ignore or show empty state
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [match?.id, seasonId])

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

                {/* Scoreboard Hero Banner */}
                <div className="p-5 sm:p-6 bg-gradient-to-b from-bg/60 to-surface border-b border-border">
                    <div className="grid grid-cols-7 items-center gap-3">
                        {/* Home Team */}
                        <div className={`col-span-3 flex items-center gap-3 ${homeWon ? '' : awayWon ? 'opacity-65' : ''}`}>
                            <div className="relative flex-shrink-0">
                                <img
                                    src={homeLogo}
                                    alt={match.homeTeamShortName ?? ''}
                                    className="w-12 h-12 sm:w-14 sm:h-14 object-contain"
                                    onError={(e) => { ;(e.target as HTMLImageElement).style.display = 'none' }}
                                />
                                {homeWon && (
                                    <div className="absolute -top-1.5 -left-1.5 bg-warning text-black rounded-full p-1 shadow">
                                        <TrophyIcon size={12} weight="fill" />
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <h2 id={titleId} className={`font-bold text-base sm:text-lg truncate ${homeWon ? 'text-text' : 'text-text-muted'}`}>
                                        {match.homeTeamShortName || match.homeTeamName}
                                    </h2>
                                    {homeWon && (
                                        <span className="text-[10px] uppercase font-bold tracking-wide text-warning bg-warning/10 border border-warning/30 px-1.5 py-0.5 rounded">
                                            {t('season.playoffWinner')}
                                        </span>
                                    )}
                                </div>
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
                                <div className="flex items-center justify-end gap-1.5">
                                    {awayWon && (
                                        <span className="text-[10px] uppercase font-bold tracking-wide text-warning bg-warning/10 border border-warning/30 px-1.5 py-0.5 rounded">
                                            {t('season.playoffWinner')}
                                        </span>
                                    )}
                                    <h2 className={`font-bold text-base sm:text-lg truncate ${awayWon ? 'text-text' : 'text-text-muted'}`}>
                                        {match.awayTeamShortName || match.awayTeamName}
                                    </h2>
                                </div>
                                <p className="text-xs text-text-muted truncate hidden sm:block">
                                    {match.awayTeamName}
                                </p>
                            </div>
                            <div className="relative flex-shrink-0">
                                <img
                                    src={awayLogo}
                                    alt={match.awayTeamShortName ?? ''}
                                    className="w-12 h-12 sm:w-14 sm:h-14 object-contain"
                                    onError={(e) => { ;(e.target as HTMLImageElement).style.display = 'none' }}
                                />
                                {awayWon && (
                                    <div className="absolute -top-1.5 -right-1.5 bg-warning text-black rounded-full p-1 shadow">
                                        <TrophyIcon size={12} weight="fill" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Events Section (Goals & Fouls/Penalties) */}
                <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
                    {loading ? (
                        <div className="py-8">
                            <LoadingSpinner />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {/* Goals Column */}
                            <div className="bg-bg/40 border border-border/80 rounded-lg p-4 flex flex-col">
                                <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/60">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded bg-primary/10 text-primary flex items-center justify-center">
                                            <HockeyIcon size={15} />
                                        </div>
                                        <h3 className="font-bold text-sm text-text">
                                            {t('season.playoffGoals')}
                                        </h3>
                                    </div>
                                    <span className="text-xs font-semibold tabular-nums text-text-muted bg-surface px-2 py-0.5 rounded border border-border">
                                        {goals.reduce((acc, g) => acc + g.event.count, 0)}
                                    </span>
                                </div>

                                {goals.length === 0 ? (
                                    <p className="text-xs text-text-muted italic py-4 text-center">
                                        {t('season.playoffNoGoals')}
                                    </p>
                                ) : (
                                    <ul className="space-y-2.5">
                                        {goals.map(({ event: g, userName }, idx) => {
                                            const playerName = `${g.playerFirstName ?? ''} ${g.playerSurname ?? ''}`.trim() || t('common.player')
                                            return (
                                                <li key={g.id || idx} className="flex items-center justify-between gap-2 text-xs bg-surface/70 border border-border/40 rounded px-3 py-2">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className="font-semibold text-text truncate">
                                                            {playerName}
                                                        </span>
                                                        {g.count > 1 && (
                                                            <span className="text-[11px] font-bold text-primary font-mono">
                                                                ×{g.count}
                                                            </span>
                                                        )}
                                                        {g.goalType === 'PowerPlay' && (
                                                            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                                                PP
                                                            </span>
                                                        )}
                                                        {g.goalType === 'ShortHanded' && (
                                                            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                                                SH
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-[11px] text-text-muted truncate flex-shrink-0">
                                                        {userName}
                                                    </span>
                                                </li>
                                            )
                                        })}
                                    </ul>
                                )}
                            </div>

                            {/* Penalties / Fouls Column */}
                            <div className="bg-bg/40 border border-border/80 rounded-lg p-4 flex flex-col">
                                <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/60">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded bg-danger/10 text-danger flex items-center justify-center">
                                            <WarningOctagonIcon size={15} />
                                        </div>
                                        <h3 className="font-bold text-sm text-text">
                                            {t('season.playoffPenalties')}
                                        </h3>
                                    </div>
                                    <span className="text-xs font-semibold tabular-nums text-text-muted bg-surface px-2 py-0.5 rounded border border-border">
                                        {penalties.reduce((acc, p) => acc + p.event.count, 0)}
                                    </span>
                                </div>

                                {penalties.length === 0 ? (
                                    <p className="text-xs text-text-muted italic py-4 text-center">
                                        {t('season.playoffNoPenalties')}
                                    </p>
                                ) : (
                                    <ul className="space-y-2.5">
                                        {penalties.map(({ event: p, userName }, idx) => {
                                            const playerName = `${p.playerFirstName ?? ''} ${p.playerSurname ?? ''}`.trim() || t('common.player')
                                            return (
                                                <li key={p.id || idx} className="flex items-center justify-between gap-2 text-xs bg-surface/70 border border-border/40 rounded px-3 py-2">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className="font-semibold text-text truncate">
                                                            {playerName}
                                                        </span>
                                                        {p.count > 1 && (
                                                            <span className="text-[11px] font-bold text-danger font-mono">
                                                                ×{p.count}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-[11px] text-text-muted truncate flex-shrink-0">
                                                        {userName}
                                                    </span>
                                                </li>
                                            )
                                        })}
                                    </ul>
                                )}
                            </div>
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
