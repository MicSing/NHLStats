import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
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

            // Load points/goals/penalties for each userMatch in parallel
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
        if (hostedScore === 0) toAdd.push(3)    // Negative: Not Scoring A Goal
        if (opponentScore === 0) toAdd.push(11) // Positive: Not Scoring A Goal
        if (hostedScore === 10) toAdd.push(12)  // Positive: Scoring 10 Goals
        if (opponentScore === 10) toAdd.push(4) // Negative: Scoring 10 Goals

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

    const EXCLUDED_NEG_REASON_IDS = [3, 4]

    const handleNegativePointAdded = async (pointReasonId: number) => {
        if (!match || EXCLUDED_NEG_REASON_IDS.includes(pointReasonId)) return
        if (isHomeHosted(match)) {
            await saveMatchScore(match.homeScore, match.awayScore + 1)
        } else {
            await saveMatchScore(match.homeScore + 1, match.awayScore)
        }
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
            <div className="max-w-4xl mx-auto">
                {/* Back link */}
                <Link
                    to={`/seasons/${seasonId}`}
                    className="text-sm text-primary hover:underline mb-4 inline-block"
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

                {/* Initialize users button (auth only) */}
                {token && (
                    <div className="mb-4">
                        <button
                            onClick={() => void handleInitializeUsers()}
                            className="btn-primary text-sm"
                        >
                            {t('match.initializeUsers')}
                        </button>
                    </div>
                )}

                {/* User Match Cards */}
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
                            onChanged={() => void loadUserMatchData(userMatch.id)}
                            onGoalAdded={handleGoalAdded}
                            onNegativePointAdded={handleNegativePointAdded}
                        />
                    ))}
                </div>

                {userMatchData.length === 0 && (
                    <p className="text-text-muted mt-4">{t('match.noUserEntries')}</p>
                )}
            </div>
        </PageLayout>
    )
}
