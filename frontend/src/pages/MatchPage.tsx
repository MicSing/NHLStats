import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowCounterClockwise, UserPlus } from '@phosphor-icons/react'
import type { Match, MatchEvent } from '../types/match'
import { CompletionType } from '../types/match'
import type {
    UserMatch,
    UserMatchPoint,
    UserMatchGoal,
    UserMatchPenalty,
} from '../types/userMatch'
import type { RosterPlayer } from '../types/roster'
import type { PointReason } from '../types/pointReason'
import type { Season } from '../types/season'
import apiClient from '../services/apiClient'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import LoadingSpinner from '../components/LoadingSpinner'
import PageLayout from '../components/PageLayout'
import { useTranslation } from 'react-i18next'
import MatchHeaderEditor from '../components/MatchHeaderEditor'
import MatchQuickActionsBar from '../components/MatchQuickActionsBar'
import MatchEventTimeline from '../components/MatchEventTimeline'
import UserMatchCard from '../components/UserMatchCard'

interface UserMatchData {
    userMatch: UserMatch
    points: UserMatchPoint[]
    goals: UserMatchGoal[]
    penalties: UserMatchPenalty[]
}

function getCurrentPeriod(m: Match, evts: MatchEvent[]): string {
    const raw = (m.completionType as unknown) as string | number | null | undefined
    if (
        raw === CompletionType.RegularTime || raw === 'RegularTime' || raw === 'REG' || raw === 'reg' ||
        raw === CompletionType.Overtime || raw === 'Overtime' || raw === 'OT' || raw === 'ot' ||
        raw === CompletionType.Shootout || raw === 'Shootout' || raw === 'SO' || raw === 'so'
    ) {
        return 'Finished'
    }
    if (raw === CompletionType.None || raw === 'None' || raw === 'none' || raw === null || raw === undefined) {
        return 'None'
    }
    const periodEvents = evts.filter((e) => e.eventType === 'PeriodChange')
    if (periodEvents.length === 0) return 'P1'
    const last = periodEvents[periodEvents.length - 1]
    return last.eventSubtype ?? 'P1'
}

export default function MatchPage() {
    const { seasonId, matchId } = useParams<{ seasonId: string; matchId: string }>()
    const { token } = useAuth()
    const { t } = useTranslation()
    const toast = useToast()

    const [match, setMatch] = useState<Match | null>(null)
    const [season, setSeason] = useState<Season | null>(null)
    const [events, setEvents] = useState<MatchEvent[]>([])
    const [userMatchData, setUserMatchData] = useState<UserMatchData[]>([])
    const [roster, setRoster] = useState<RosterPlayer[]>([])
    const [pointReasons, setPointReasons] = useState<PointReason[]>([])
    const [loading, setLoading] = useState(true)
    const [resetting, setResetting] = useState(false)

    const loadUserMatchData = async (userMatchId: number) => {
        if (!seasonId || !matchId) return
        const [points, goals, penalties, updatedMatch, updatedEvents] = await Promise.all([
            apiClient.get<UserMatchPoint[]>(`/api/usermatches/${userMatchId}/points`),
            apiClient.get<UserMatchGoal[]>(`/api/usermatches/${userMatchId}/goals`),
            apiClient.get<UserMatchPenalty[]>(`/api/usermatches/${userMatchId}/penalties`),
            apiClient.get<Match>(`/api/seasons/${seasonId}/matches/${matchId}`),
            apiClient.get<MatchEvent[]>(`/api/matches/${matchId}/events`),
        ])
        setMatch(updatedMatch)
        setEvents(updatedEvents)
        setUserMatchData((prev) =>
            prev.map((d) =>
                d.userMatch.id === userMatchId ? { ...d, points, goals, penalties } : d,
            ),
        )
    }

    const loadAll = async () => {
        if (!seasonId || !matchId) return
        try {
            const [matchData, seasonData, userMatches, rosterData, reasons, eventsData] = await Promise.all([
                apiClient.get<Match>(`/api/seasons/${seasonId}/matches/${matchId}`),
                apiClient.get<Season>(`/api/seasons/${seasonId}`),
                apiClient.get<UserMatch[]>(
                    `/api/seasons/${seasonId}/matches/${matchId}/usermatches`,
                ),
                apiClient.get<RosterPlayer[]>(`/api/seasons/${seasonId}/roster`),
                apiClient.get<PointReason[]>('/api/pointreasons'),
                apiClient.get<MatchEvent[]>(`/api/matches/${matchId}/events`),
            ])

            setMatch(matchData)
            setSeason(seasonData)
            setRoster(rosterData)
            setPointReasons(reasons)
            setEvents(eventsData)

            const enriched = await Promise.all(
                userMatches.map(async (um) => {
                    const [points, goals, penalties] = await Promise.all([
                        apiClient.get<UserMatchPoint[]>(`/api/usermatches/${um.id}/points`),
                        apiClient.get<UserMatchGoal[]>(`/api/usermatches/${um.id}/goals`),
                        apiClient.get<UserMatchPenalty[]>(`/api/usermatches/${um.id}/penalties`),
                    ])
                    return { userMatch: um, points, goals, penalties }
                }),
            )

            setUserMatchData(enriched)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void loadAll()
    }, [seasonId, matchId]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleInitializeUsers = async () => {
        await apiClient.post(
            `/api/seasons/${seasonId}/matches/${matchId}/usermatches/initialize`,
            {},
        )
        await loadAll()
    }

    const handleResetMatch = async () => {
        if (!seasonId || !matchId) return
        if (!window.confirm(t('match.resetMatchConfirm'))) return
        setResetting(true)
        try {
            await apiClient.post(`/api/seasons/${seasonId}/matches/${matchId}/reset`, {})
            await loadAll()
            toast.success(t('match.resetMatchSuccess'))
        } catch {
            toast.error(t('match.resetMatchError'))
        } finally {
            setResetting(false)
        }
    }

    const isHomeHosted = (m: Match) => m.homeTeamId === season?.hostedTeamId

    const saveMatchScore = async (homeScore: number, awayScore: number) => {
        if (!match || !seasonId || !matchId) return
        const updated = await apiClient.put<Match>(
            `/api/seasons/${seasonId}/matches/${matchId}`,
            {
                homeTeamId: match.homeTeamId,
                awayTeamId: match.awayTeamId,
                homeScore,
                awayScore,
                completionType: match.completionType,
                matchDate: match.matchDate,
                phase: match.phase,
                playoffRound: match.playoffRound,
            },
        )
        setMatch(updated)
    }

    const handleGoalAdded = async () => {
        if (!match) return
        if (isHomeHosted(match)) {
            await saveMatchScore(match.homeScore + 1, match.awayScore)
        } else {
            await saveMatchScore(match.homeScore, match.awayScore + 1)
        }
        await loadAll()
    }

    const handleGoalRemoved = async () => {
        if (!match) return
        if (isHomeHosted(match)) {
            await saveMatchScore(Math.max(0, match.homeScore - 1), match.awayScore)
        } else {
            await saveMatchScore(match.homeScore, Math.max(0, match.awayScore - 1))
        }
        await loadAll()
    }

    const handleDefensiveBlunder = async () => {
        if (!matchId) return
        await apiClient.post(`/api/matches/${matchId}/events`, {
            eventType: 'Goal',
            isOpponent: true,
        })
        await loadAll()
    }

    const handleTransitionPeriod = async (targetPeriod: string) => {
        if (!matchId) return
        await apiClient.post(`/api/matches/${matchId}/events`, {
            eventType: 'PeriodChange',
            eventSubtype: targetPeriod,
        })
        await loadAll()
    }

    const handleEndMatch = async (subtype: 'REG' | 'OT') => {
        if (!matchId) return
        await apiClient.post(`/api/matches/${matchId}/events`, {
            eventType: 'MatchEnd',
            eventSubtype: subtype,
        })
        await loadAll()
        toast.success(t('match.endMatchSuccess', 'Zápas bol úspešne ukončený'))
    }

    const handleEndShootout = async () => {
        if (!matchId) return
        try {
            await apiClient.post(`/api/matches/${matchId}/events/end-shootout`, {})
            await loadAll()
            toast.success(t('match.endMatchSuccess', 'Zápas bol úspešne ukončený'))
        } catch (err: unknown) {
            const apiError = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data
            const msg = apiError?.error || apiError?.message || t('match.shootoutTieError')
            toast.error(msg)
        }
    }

    const handleReopenMatch = async () => {
        if (!seasonId || !matchId) return
        const endEvent = [...events].reverse().find((e) => e.eventType === 'MatchEnd')
        if (endEvent) {
            await apiClient.delete(`/api/matches/${matchId}/events/${endEvent.id}`)
        } else if (match) {
            let hs = match.homeScore
            let as_ = match.awayScore
            if (match.completionType === CompletionType.Shootout) {
                const minScore = Math.min(hs, as_)
                hs = minScore
                as_ = minScore
            }
            await apiClient.put(`/api/seasons/${seasonId}/matches/${matchId}`, {
                ...match,
                homeScore: hs,
                awayScore: as_,
                completionType: CompletionType.InProgress,
            })
        }
        await loadAll()
        toast.success(t('match.reopenedSuccess', 'Zápas bol opäť otvorený'))
    }

    const NEUTRAL_TO_NEGATIVE_MAP: Record<number, number> = { 21: 19, 22: 20 }

    const handleNegativePointAdded = async (_pointReasonId: number) => {
        // Goal against events are handled strictly via handleDefensiveBlunder
    }

    const handleNeutralPointAdded = async (userMatchId: number, pointReasonId: number) => {
        const negativeReasonId = NEUTRAL_TO_NEGATIVE_MAP[pointReasonId]
        if (!negativeReasonId) return

        const entry = userMatchData.find((d) => d.userMatch.id === userMatchId)
        if (!entry) return

        const currentCount =
            entry.points
                .filter((p) => p.pointReasonId === pointReasonId)
                .reduce((sum, p) => sum + p.count, 0) + 1

        if (currentCount % 3 === 0) {
            await apiClient.post(`/api/usermatches/${userMatchId}/points`, {
                pointReasonId: negativeReasonId,
                count: 1,
            })
        }
    }

    const handleJumpToUser = (userId: number) => {
        const el = document.getElementById(`user-${userId}`)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    if (loading)
        return (
            <PageLayout>
                <LoadingSpinner />
            </PageLayout>
        )
    if (!match)
        return (
            <PageLayout>
                <p className="text-text-muted">{t('match.matchNotFound')}</p>
            </PageLayout>
        )

    const currentPeriod = getCurrentPeriod(match, events)

    return (
        <PageLayout>
            <div className="max-w-5xl mx-auto pb-12">
                {/* Back link */}
                <Link
                    to={`/seasons/${seasonId}`}
                    className="text-sm text-text-muted hover:text-text flex items-center gap-1.5 mb-5 transition-colors"
                >
                    {t('match.backToSeason')}
                </Link>

                {/* Match header */}
                <MatchHeaderEditor
                    seasonId={seasonId!}
                    match={match}
                    isAuth={!!token}
                    currentPeriod={currentPeriod}
                    onSaved={setMatch}
                    onTransitionPeriod={handleTransitionPeriod}
                    onEndMatch={handleEndMatch}
                    onEndShootout={handleEndShootout}
                    onReopenMatch={handleReopenMatch}
                />

                {/* Quick actions for teams */}
                <MatchQuickActionsBar
                    matchId={Number(matchId)}
                    isHomeHosted={isHomeHosted(match)}
                    homeTeamName={match.homeTeamName}
                    awayTeamName={match.awayTeamName}
                    isShootout={currentPeriod === 'SO'}
                    isMatchFinished={currentPeriod === 'Finished'}
                    isAuth={!!token}
                    onEventAdded={loadAll}
                />

                {/* Action bar */}
                {token && (
                    <div className="mb-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
                        <button
                            onClick={() => void handleInitializeUsers()}
                            className="flex items-center gap-2 border border-primary text-primary hover:bg-primary/10 font-semibold rounded-lg px-4 py-2 text-sm transition-colors"
                        >
                            <UserPlus size={16} />
                            {t('match.initializeUsers')}
                        </button>

                        <button
                            onClick={() => void handleResetMatch()}
                            disabled={resetting}
                            className="flex items-center gap-2 border border-red-500 text-red-500 hover:bg-red-500/10 font-semibold rounded-lg px-4 py-2 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ArrowCounterClockwise size={16} />
                            {t('match.resetMatch')}
                        </button>
                    </div>
                )}

                {/* Sticky quick-jump bar */}
                {userMatchData.length > 1 && (
                    <div className="card bg-surface/90 backdrop-blur-sm p-3 mb-5 sticky top-[68px] lg:top-4 z-40 shadow-lg">
                        <div className="flex flex-wrap gap-2 max-h-[112px] overflow-y-auto">
                            {userMatchData.map(({ userMatch: um }) => (
                                <button
                                    key={`jump-${um.id}`}
                                    onClick={() => handleJumpToUser(um.id)}
                                    className="bg-bg hover:bg-primary/10 text-text-muted hover:text-primary border border-border hover:border-primary/40 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                                >
                                    {um.userName}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* User match cards */}
                <div className="space-y-4">
                    {userMatchData.map(({ userMatch, points, goals, penalties }) => (
                        <UserMatchCard
                            key={userMatch.id}
                            userMatch={userMatch}
                            points={points}
                            goals={goals}
                            penalties={penalties}
                            roster={roster}
                            pointReasons={pointReasons}
                            allUserMatches={userMatchData.map((d) => d.userMatch)}
                            isAuth={!!token}
                            onChanged={(extraId) => {
                                void loadUserMatchData(userMatch.id)
                                if (extraId !== undefined) void loadUserMatchData(extraId)
                            }}
                            onDeleted={() => void loadAll()}
                            onGoalAdded={handleGoalAdded}
                            onGoalRemoved={handleGoalRemoved}
                            onNegativePointAdded={handleNegativePointAdded}
                            onNeutralPointAdded={handleNeutralPointAdded}
                            onDefensiveBlunder={handleDefensiveBlunder}
                        />
                    ))}

                    {userMatchData.length === 0 && (
                        <p className="text-text-muted mt-4">{t('match.noUserEntries')}</p>
                    )}
                </div>

                {/* Match Event Timeline */}
                <MatchEventTimeline
                    matchId={Number(matchId)}
                    events={events}
                    isAuth={!!token}
                    homeTeamName={match.homeTeamName}
                    awayTeamName={match.awayTeamName}
                    isHomeHosted={isHomeHosted(match)}
                    onEventsChanged={loadAll}
                />
            </div>
        </PageLayout>
    )
}
