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
import apiClient from '../services/apiClient'
import { useAuth } from '../context/AuthContext'
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

    const [match, setMatch] = useState<Match | null>(null)
    const [userMatchData, setUserMatchData] = useState<UserMatchData[]>([])
    const [roster, setRoster] = useState<RosterPlayer[]>([])
    const [pointReasons, setPointReasons] = useState<PointReason[]>([])
    const [loading, setLoading] = useState(true)

    const loadAll = async () => {
        if (!seasonId || !matchId) return
        try {
            const [matchData, userMatches, rosterData, reasons] = await Promise.all([
                apiClient.get<Match>(`/api/seasons/${seasonId}/matches/${matchId}`),
                apiClient.get<UserMatch[]>(
                    `/api/seasons/${seasonId}/matches/${matchId}/usermatches`,
                ),
                apiClient.get<RosterPlayer[]>(`/api/seasons/${seasonId}/roster`),
                apiClient.get<PointReason[]>('/api/pointreasons'),
            ])

            setMatch(matchData)
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
        // Auto-set matchDate to today if currently null
        if (match && match.matchDate === null) {
            const today = new Date().toISOString().split('T')[0]
            const updated = await apiClient.put<Match>(
                `/api/seasons/${seasonId}/matches/${matchId}`,
                {
                    homeTeamId: match.homeTeamId,
                    awayTeamId: match.awayTeamId,
                    homeScore: match.homeScore,
                    awayScore: match.awayScore,
                    completionType: match.completionType,
                    matchDate: today,
                },
            )
            setMatch(updated)
        }
        await loadAll()
    }

    if (loading)
        return (
            <div className="min-h-screen bg-bg text-text p-6">
                <p className="text-text-muted">Loading…</p>
            </div>
        )
    if (!match)
        return (
            <div className="min-h-screen bg-bg text-text p-6">
                <p className="text-text-muted">Match not found</p>
            </div>
        )

    return (
        <div className="min-h-screen bg-bg text-text p-6">
            <div className="max-w-4xl mx-auto">
                {/* Back link */}
                <Link
                    to={`/seasons/${seasonId}`}
                    className="text-sm text-primary hover:underline mb-4 inline-block"
                >
                    ← Back to Season
                </Link>

                {/* Match header */}
                <MatchHeaderEditor
                    seasonId={seasonId!}
                    match={match}
                    isAuth={!!token}
                    onSaved={setMatch}
                />

                {/* Initialize users button (auth only) */}
                {token && (
                    <div className="mb-4">
                        <button
                            onClick={() => void handleInitializeUsers()}
                            className="btn-primary text-sm"
                        >
                            Initialize Users
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
                            isAuth={!!token}
                            onChanged={() => void loadAll()}
                        />
                    ))}
                </div>

                {userMatchData.length === 0 && (
                    <p className="text-text-muted mt-4">No user entries for this match yet.</p>
                )}
            </div>
        </div>
    )
}
