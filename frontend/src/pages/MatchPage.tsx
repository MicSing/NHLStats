import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Match } from '../types/match'
import type {
    UserMatch,
    UserMatchPoint,
    UserMatchGoal,
    UserMatchPenalty,
    CreateUserMatchPointDto,
    CreateUserMatchGoalDto,
    CreateUserMatchPenaltyDto,
} from '../types/userMatch'
import type { RosterPlayer } from '../types/roster'
import type { PointReason } from '../types/pointReason'
import apiClient from '../services/apiClient'
import { useAuth } from '../context/AuthContext'

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

    // Per-user-match form state
    const [pointForms, setPointForms] = useState<
        Record<number, { pointReasonId: number | ''; count: number }>
    >({})
    const [goalForms, setGoalForms] = useState<
        Record<number, { rosterPlayerId: number | ''; count: number }>
    >({})
    const [penaltyForms, setPenaltyForms] = useState<
        Record<number, { rosterPlayerId: number | ''; count: number }>
    >({})

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

            // Initialise blank form state for each userMatch
            const ptForms: Record<number, { pointReasonId: number | ''; count: number }> = {}
            const gForms: Record<number, { rosterPlayerId: number | ''; count: number }> = {}
            const pForms: Record<number, { rosterPlayerId: number | ''; count: number }> = {}
            enriched.forEach(({ userMatch: um }) => {
                ptForms[um.id] = { pointReasonId: '', count: 1 }
                gForms[um.id] = { rosterPlayerId: '', count: 1 }
                pForms[um.id] = { rosterPlayerId: '', count: 1 }
            })
            setPointForms(ptForms)
            setGoalForms(gForms)
            setPenaltyForms(pForms)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void loadAll()
    }, [seasonId, matchId]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleAddPoint = async (userMatchId: number) => {
        const form = pointForms[userMatchId]
        if (!form || form.pointReasonId === '') return
        await apiClient.post<UserMatchPoint>(`/api/usermatches/${userMatchId}/points`, {
            pointReasonId: form.pointReasonId,
            count: form.count,
        } as CreateUserMatchPointDto)
        await loadAll()
    }

    const handleDeletePoint = async (userMatchId: number, pointId: number) => {
        await apiClient.delete(`/api/usermatches/${userMatchId}/points/${pointId}`)
        await loadAll()
    }

    const handleAddGoal = async (userMatchId: number) => {
        const form = goalForms[userMatchId]
        if (!form || form.rosterPlayerId === '') return
        await apiClient.post<UserMatchGoal>(`/api/usermatches/${userMatchId}/goals`, {
            rosterPlayerId: form.rosterPlayerId,
            count: form.count,
        } as CreateUserMatchGoalDto)
        await loadAll()
    }

    const handleDeleteGoal = async (userMatchId: number, goalId: number) => {
        await apiClient.delete(`/api/usermatches/${userMatchId}/goals/${goalId}`)
        await loadAll()
    }

    const handleAddPenalty = async (userMatchId: number) => {
        const form = penaltyForms[userMatchId]
        if (!form || form.rosterPlayerId === '') return
        await apiClient.post<UserMatchPenalty>(`/api/usermatches/${userMatchId}/penalties`, {
            rosterPlayerId: form.rosterPlayerId,
            count: form.count,
        } as CreateUserMatchPenaltyDto)
        await loadAll()
    }

    const handleDeletePenalty = async (userMatchId: number, penaltyId: number) => {
        await apiClient.delete(`/api/usermatches/${userMatchId}/penalties/${penaltyId}`)
        await loadAll()
    }

    const handleInitializeUsers = async () => {
        await apiClient.post(
            `/api/seasons/${seasonId}/matches/${matchId}/usermatches/initialize`,
            {},
        )
        await loadAll()
    }

    if (loading)
        return (
            <div className="min-h-screen bg-gray-900 text-white p-6">
                <p>Loading…</p>
            </div>
        )
    if (!match)
        return (
            <div className="min-h-screen bg-gray-900 text-white p-6">
                <p>Match not found</p>
            </div>
        )

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6">
            <div className="max-w-4xl mx-auto">
                {/* Back link */}
                <Link
                    to={`/seasons/${seasonId}`}
                    className="text-sm text-cyan-400 hover:underline mb-4 inline-block"
                >
                    ← Back to Season
                </Link>

                {/* Match header */}
                <div className="bg-gray-800 rounded-xl p-6 mb-6">
                    <div className="flex items-center justify-between">
                        <div className="text-center flex-1">
                            <p className="text-xl font-bold">{match.homeTeamName}</p>
                        </div>
                        <div className="text-center px-6">
                            <p className="text-4xl font-mono font-bold">
                                {match.homeScore} – {match.awayScore}
                            </p>
                            <p className="text-sm text-gray-400 mt-1">
                                {new Date(match.matchDate).toLocaleDateString()}
                            </p>
                        </div>
                        <div className="text-center flex-1">
                            <p className="text-xl font-bold">{match.awayTeamName}</p>
                        </div>
                    </div>
                </div>

                {/* Initialize users button (auth only) */}
                {token && (
                    <div className="mb-4">
                        <button
                            onClick={() => void handleInitializeUsers()}
                            className="text-sm bg-cyan-700 hover:bg-cyan-600 px-4 py-2 rounded"
                        >
                            Initialize Users
                        </button>
                    </div>
                )}

                {/* User Match Cards */}
                <div className="space-y-4">
                    {userMatchData.map(({ userMatch: um, points, goals, penalties }) => (
                        <div key={um.id} className="bg-gray-800 rounded-xl p-5">
                            {/* Card header */}
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold">{um.userName}</h2>
                                <div className="flex gap-4 text-sm">
                                    <span className="text-green-400">+{um.totalPlus}</span>
                                    <span className="text-red-400">−{um.totalMinus}</span>
                                </div>
                            </div>

                            {/* Points section */}
                            <div className="mb-4">
                                <h3 className="text-sm font-medium text-gray-400 mb-2">Points</h3>
                                {points.map((p) => (
                                    <div
                                        key={p.id}
                                        className="flex items-center justify-between text-sm py-1"
                                    >
                                        <span>
                                            {p.pointReasonName} × {p.count}
                                        </span>
                                        {token && (
                                            <button
                                                aria-label={`delete point ${p.id}`}
                                                onClick={() =>
                                                    void handleDeletePoint(um.id, p.id)
                                                }
                                                className="text-red-400 hover:text-red-300 text-xs ml-4"
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {token && (
                                    <form
                                        aria-label={`add point for ${um.userName}`}
                                        onSubmit={(e) => {
                                            e.preventDefault()
                                            void handleAddPoint(um.id)
                                        }}
                                        className="flex gap-2 mt-2"
                                    >
                                        <select
                                            aria-label="point reason"
                                            value={pointForms[um.id]?.pointReasonId ?? ''}
                                            onChange={(e) =>
                                                setPointForms((prev) => ({
                                                    ...prev,
                                                    [um.id]: {
                                                        ...prev[um.id],
                                                        pointReasonId:
                                                            e.target.value === ''
                                                                ? ''
                                                                : Number(e.target.value),
                                                    },
                                                }))
                                            }
                                            className="bg-gray-700 rounded px-2 py-1 text-sm"
                                        >
                                            <option value="">Select reason</option>
                                            {pointReasons.map((r) => (
                                                <option key={r.id} value={r.id}>
                                                    {r.name}
                                                </option>
                                            ))}
                                        </select>
                                        <input
                                            type="number"
                                            aria-label="point count"
                                            min={1}
                                            value={pointForms[um.id]?.count ?? 1}
                                            onChange={(e) =>
                                                setPointForms((prev) => ({
                                                    ...prev,
                                                    [um.id]: {
                                                        ...prev[um.id],
                                                        count: Number(e.target.value),
                                                    },
                                                }))
                                            }
                                            className="bg-gray-700 rounded px-2 py-1 text-sm w-16"
                                        />
                                        <button
                                            type="submit"
                                            className="bg-cyan-700 hover:bg-cyan-600 px-3 py-1 rounded text-sm"
                                        >
                                            Add
                                        </button>
                                    </form>
                                )}
                            </div>

                            {/* Goals section */}
                            <div className="mb-4">
                                <h3 className="text-sm font-medium text-gray-400 mb-2">Goals</h3>
                                {goals.map((g) => (
                                    <div
                                        key={g.id}
                                        className="flex items-center justify-between text-sm py-1"
                                    >
                                        <span>
                                            {g.playerFirstName} {g.playerSurname} × {g.count}
                                        </span>
                                        {token && (
                                            <button
                                                aria-label={`delete goal ${g.id}`}
                                                onClick={() => void handleDeleteGoal(um.id, g.id)}
                                                className="text-red-400 hover:text-red-300 text-xs ml-4"
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {token && (
                                    <form
                                        aria-label={`add goal for ${um.userName}`}
                                        onSubmit={(e) => {
                                            e.preventDefault()
                                            void handleAddGoal(um.id)
                                        }}
                                        className="flex gap-2 mt-2"
                                    >
                                        <select
                                            aria-label="goal player"
                                            value={goalForms[um.id]?.rosterPlayerId ?? ''}
                                            onChange={(e) =>
                                                setGoalForms((prev) => ({
                                                    ...prev,
                                                    [um.id]: {
                                                        ...prev[um.id],
                                                        rosterPlayerId:
                                                            e.target.value === ''
                                                                ? ''
                                                                : Number(e.target.value),
                                                    },
                                                }))
                                            }
                                            className="bg-gray-700 rounded px-2 py-1 text-sm"
                                        >
                                            <option value="">Select player</option>
                                            {roster.map((r) => (
                                                <option key={r.id} value={r.id}>
                                                    {r.firstName} {r.surname}
                                                </option>
                                            ))}
                                        </select>
                                        <input
                                            type="number"
                                            aria-label="goal count"
                                            min={1}
                                            value={goalForms[um.id]?.count ?? 1}
                                            onChange={(e) =>
                                                setGoalForms((prev) => ({
                                                    ...prev,
                                                    [um.id]: {
                                                        ...prev[um.id],
                                                        count: Number(e.target.value),
                                                    },
                                                }))
                                            }
                                            className="bg-gray-700 rounded px-2 py-1 text-sm w-16"
                                        />
                                        <button
                                            type="submit"
                                            className="bg-cyan-700 hover:bg-cyan-600 px-3 py-1 rounded text-sm"
                                        >
                                            Add
                                        </button>
                                    </form>
                                )}
                            </div>

                            {/* Penalties section */}
                            <div>
                                <h3 className="text-sm font-medium text-gray-400 mb-2">
                                    Penalties
                                </h3>
                                {penalties.map((p) => (
                                    <div
                                        key={p.id}
                                        className="flex items-center justify-between text-sm py-1"
                                    >
                                        <span>
                                            {p.playerFirstName} {p.playerSurname} × {p.count}
                                        </span>
                                        {token && (
                                            <button
                                                aria-label={`delete penalty ${p.id}`}
                                                onClick={() =>
                                                    void handleDeletePenalty(um.id, p.id)
                                                }
                                                className="text-red-400 hover:text-red-300 text-xs ml-4"
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {token && (
                                    <form
                                        aria-label={`add penalty for ${um.userName}`}
                                        onSubmit={(e) => {
                                            e.preventDefault()
                                            void handleAddPenalty(um.id)
                                        }}
                                        className="flex gap-2 mt-2"
                                    >
                                        <select
                                            aria-label="penalty player"
                                            value={penaltyForms[um.id]?.rosterPlayerId ?? ''}
                                            onChange={(e) =>
                                                setPenaltyForms((prev) => ({
                                                    ...prev,
                                                    [um.id]: {
                                                        ...prev[um.id],
                                                        rosterPlayerId:
                                                            e.target.value === ''
                                                                ? ''
                                                                : Number(e.target.value),
                                                    },
                                                }))
                                            }
                                            className="bg-gray-700 rounded px-2 py-1 text-sm"
                                        >
                                            <option value="">Select player</option>
                                            {roster.map((r) => (
                                                <option key={r.id} value={r.id}>
                                                    {r.firstName} {r.surname}
                                                </option>
                                            ))}
                                        </select>
                                        <input
                                            type="number"
                                            aria-label="penalty count"
                                            min={1}
                                            value={penaltyForms[um.id]?.count ?? 1}
                                            onChange={(e) =>
                                                setPenaltyForms((prev) => ({
                                                    ...prev,
                                                    [um.id]: {
                                                        ...prev[um.id],
                                                        count: Number(e.target.value),
                                                    },
                                                }))
                                            }
                                            className="bg-gray-700 rounded px-2 py-1 text-sm w-16"
                                        />
                                        <button
                                            type="submit"
                                            className="bg-cyan-700 hover:bg-cyan-600 px-3 py-1 rounded text-sm"
                                        >
                                            Add
                                        </button>
                                    </form>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {userMatchData.length === 0 && (
                    <p className="text-gray-400 mt-4">No user entries for this match yet.</p>
                )}
            </div>
        </div>
    )
}
