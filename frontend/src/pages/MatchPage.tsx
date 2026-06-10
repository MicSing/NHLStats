import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { UserPlus } from '@phosphor-icons/react'
import type { Match } from '../types/match'
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
import LoadingSpinner from '../components/LoadingSpinner'
import PageLayout from '../components/PageLayout'
import { useTranslation } from 'react-i18next'
import MatchHeaderEditor from '../components/MatchHeaderEditor'
import UserMatchCard from '../components/UserMatchCard'

interface UserMatchData {
    userMatch: UserMatch
    points: UserMatchPoint[]
    goals: UserMatchGoal[]
    penalties: UserMatchPenalty[]
}

export default function MatchPage() {
    const { seasonId, matchId } = useParams<{ seasonId: string; matchId: string }>()
    const { token } = useAuth()
    const { t } = useTranslation()

    const [match, setMatch] = useState<Match | null>(null)
    const [season, setSeason] = useState<Season | null>(null)
    const [userMatchData, setUserMatchData] = useState<UserMatchData[]>([])
    const [roster, setRoster] = useState<RosterPlayer[]>([])
    const [pointReasons, setPointReasons] = useState<PointReason[]>([])
    const [loading, setLoading] = useState(true)


    const loadUserMatchData = async (userMatchId: number) => {
        if (!seasonId || !matchId) return
        const [points, goals, penalties, updatedMatch] = await Promise.all([
            apiClient.get<UserMatchPoint[]>(`/api/usermatches/${userMatchId}/points`),
            apiClient.get<UserMatchGoal[]>(`/api/usermatches/${userMatchId}/goals`),
            apiClient.get<UserMatchPenalty[]>(`/api/usermatches/${userMatchId}/penalties`),
            apiClient.get<Match>(`/api/seasons/${seasonId}/matches/${matchId}`),
        ])
        setMatch(updatedMatch)
        setUserMatchData((prev) =>
            prev.map((d) =>
                d.userMatch.id === userMatchId ? { ...d, points, goals, penalties } : d,
            ),
        )
    }

    const loadAll = async () => {
        if (!seasonId || !matchId) return
        try {
            const [matchData, seasonData, userMatches, rosterData, reasons] = await Promise.all([
                apiClient.get<Match>(`/api/seasons/${seasonId}/matches/${matchId}`),
                apiClient.get<Season>(`/api/seasons/${seasonId}`),
                apiClient.get<UserMatch[]>(
                    `/api/seasons/${seasonId}/matches/${matchId}/usermatches`,
                ),
                apiClient.get<RosterPlayer[]>(`/api/seasons/${seasonId}/roster`),
                apiClient.get<PointReason[]>('/api/pointreasons'),
            ])

            setMatch(matchData)
            setSeason(seasonData)
            setRoster(rosterData)
            setPointReasons(reasons)

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

    const isHomeHosted = (m: Match) => m.homeTeamId === season?.hostedTeamId

    const handleMatchFinished = async (homeScore: number, awayScore: number) => {
        const hostedIsHome = match ? isHomeHosted(match) : true
        const hostedScore = hostedIsHome ? homeScore : awayScore
        const opponentScore = hostedIsHome ? awayScore : homeScore

        const toAdd: number[] = []
        if (hostedScore === 0) toAdd.push(3)
        if (opponentScore === 0) toAdd.push(11)
        if (hostedScore === 10) toAdd.push(12)
        if (opponentScore === 10) toAdd.push(4)

        for (const { userMatch, points } of userMatchData) {
            for (const pointReasonId of toAdd) {
                if (!points.some((p) => p.pointReasonId === pointReasonId)) {
                    await apiClient.post(`/api/usermatches/${userMatch.id}/points`, {
                        pointReasonId,
                        count: 1,
                    })
                }
            }
        }
        await loadAll()
    }

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
    }

    const EXCLUDED_NEG_REASON_IDS = [2, 3, 4, 5, 19, 20]
    const NEUTRAL_TO_NEGATIVE_MAP: Record<number, number> = { 21: 19, 22: 20 }

    const handleNegativePointAdded = async (pointReasonId: number) => {
        if (!match || EXCLUDED_NEG_REASON_IDS.includes(pointReasonId)) return
        if (isHomeHosted(match)) {
            await saveMatchScore(match.homeScore, match.awayScore + 1)
        } else {
            await saveMatchScore(match.homeScore + 1, match.awayScore)
        }
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
                    onSaved={setMatch}
                    onMatchFinished={(hs, awayS) => void handleMatchFinished(hs, awayS)}
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
                            onNegativePointAdded={handleNegativePointAdded}
                            onNeutralPointAdded={handleNeutralPointAdded}
                        />
                    ))}

                    {userMatchData.length === 0 && (
                        <p className="text-text-muted mt-4">{t('match.noUserEntries')}</p>
                    )}
                </div>
            </div>
        </PageLayout>
    )
}
