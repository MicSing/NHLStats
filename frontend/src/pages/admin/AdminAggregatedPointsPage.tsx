import { useEffect, useState } from 'react'
import type { Season, SeasonDetail } from '../../types/season'
import type { UserMatch, UserMatchPoint, UserMatchGoal, UserMatchPenalty } from '../../types/userMatch'
import type { RosterPlayer } from '../../types/roster'
import type { PointReason } from '../../types/pointReason'
import apiClient from '../../services/apiClient'
import Modal from '../../components/Modal'
import UserMatchCard from '../../components/UserMatchCard'
import { useAuth } from '../../context/AuthContext'

interface EnrichedEntry {
    userMatch: UserMatch
    points: UserMatchPoint[]
    goals: UserMatchGoal[]
    penalties: UserMatchPenalty[]
}

export default function AdminAggregatedPointsPage() {
    const { token } = useAuth()
    const isAuth = !!token

    const [seasons, setSeasons] = useState<Season[]>([])
    const [selectedSeasonId, setSelectedSeasonId] = useState<number | ''>('')
    const [seasonDetail, setSeasonDetail] = useState<SeasonDetail | null>(null)
    const [entries, setEntries] = useState<EnrichedEntry[]>([])
    const [roster, setRoster] = useState<RosterPlayer[]>([])
    const [pointReasons, setPointReasons] = useState<PointReason[]>([])
    const [loadingSeasons, setLoadingSeasons] = useState(true)
    const [loadingEntries, setLoadingEntries] = useState(false)
    const [creating, setCreating] = useState<number | null>(null) // userId being created
    const [error, setError] = useState<string | null>(null)
    const [manageEntry, setManageEntry] = useState<EnrichedEntry | null>(null)

    // Load seasons + point reasons once
    useEffect(() => {
        Promise.all([
            apiClient.get<Season[]>('/api/seasons'),
            apiClient.get<PointReason[]>('/api/pointreasons'),
        ])
            .then(([s, pr]) => {
                setSeasons(s)
                setPointReasons(pr)
            })
            .catch(() => setError('Failed to load seasons'))
            .finally(() => setLoadingSeasons(false))
    }, [])

    const loadEntries = async (seasonId: number) => {
        setLoadingEntries(true)
        setError(null)
        try {
            const [detail, rawEntries, rosterData] = await Promise.all([
                apiClient.get<SeasonDetail>(`/api/seasons/${seasonId}`),
                apiClient.get<UserMatch[]>(`/api/seasons/${seasonId}/usermatches`),
                apiClient.get<RosterPlayer[]>(`/api/seasons/${seasonId}/roster`),
            ])
            setSeasonDetail(detail)
            setRoster(rosterData)

            // Enrich each aggregated entry with its points/goals/penalties
            const enriched = await Promise.all(
                rawEntries.map(async (um) => {
                    const [points, goals, penalties] = await Promise.all([
                        apiClient.get<UserMatchPoint[]>(`/api/usermatches/${um.id}/points`),
                        apiClient.get<UserMatchGoal[]>(`/api/usermatches/${um.id}/goals`),
                        apiClient.get<UserMatchPenalty[]>(`/api/usermatches/${um.id}/penalties`),
                    ])
                    return { userMatch: um, points, goals, penalties }
                }),
            )
            setEntries(enriched)
        } catch {
            setError('Failed to load aggregated entries')
        } finally {
            setLoadingEntries(false)
        }
    }

    const handleSeasonChange = (id: number | '') => {
        setSelectedSeasonId(id)
        setEntries([])
        setSeasonDetail(null)
        setManageEntry(null)
        if (id !== '') void loadEntries(id)
    }

    const handleCreate = async (userId: number) => {
        if (selectedSeasonId === '') return
        setCreating(userId)
        setError(null)
        try {
            await apiClient.post<UserMatch>(`/api/seasons/${selectedSeasonId}/usermatches`, { userId })
            await loadEntries(selectedSeasonId as number)
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to create entry')
        } finally {
            setCreating(null)
        }
    }

    const handleDelete = async (userMatchId: number) => {
        if (!window.confirm('Delete this aggregated entry and all its points?')) return
        await apiClient.delete(`/api/usermatches/${userMatchId}`)
        setManageEntry(null)
        if (selectedSeasonId !== '') await loadEntries(selectedSeasonId as number)
    }

    const refreshManageEntry = async () => {
        if (!manageEntry || selectedSeasonId === '') return
        await loadEntries(selectedSeasonId as number)
        // Re-find the refreshed entry
        const updated = entries.find((e) => e.userMatch.id === manageEntry.userMatch.id)
        if (updated) setManageEntry(updated)
    }

    // After loadEntries, keep the open modal in sync
    useEffect(() => {
        if (manageEntry) {
            const refreshed = entries.find((e) => e.userMatch.id === manageEntry.userMatch.id)
            if (refreshed) setManageEntry(refreshed)
        }
    }, [entries]) // eslint-disable-line react-hooks/exhaustive-deps

    if (loadingSeasons) return <p>Loading…</p>

    // Users that don't yet have an aggregated entry
    const usersWithEntry = new Set(entries.map((e) => e.userMatch.userId))
    const usersWithoutEntry = seasonDetail?.users.filter((u) => !usersWithEntry.has(u.id)) ?? []

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-cyan-400">Aggregated Points</h1>
            </div>

            <p className="text-sm text-gray-400 mb-6">
                Aggregated points are season-level entries not tied to a specific match — use them
                for bonus points, manual adjustments, or pre-season carryovers.
            </p>

            {/* Season selector */}
            <div className="mb-6">
                <label className="block text-sm mb-1 text-gray-300">Season</label>
                <select
                    value={selectedSeasonId}
                    onChange={(e) =>
                        handleSeasonChange(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white min-w-48"
                >
                    <option value="">Select a season…</option>
                    {seasons.map((s) => (
                        <option key={s.id} value={s.id}>
                            {s.name}
                        </option>
                    ))}
                </select>
            </div>

            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

            {selectedSeasonId !== '' && loadingEntries && <p>Loading entries…</p>}

            {selectedSeasonId !== '' && !loadingEntries && seasonDetail && (
                <>
                    {/* Existing entries */}
                    {entries.length > 0 && (
                        <section className="mb-8">
                            <h2 className="text-base font-semibold text-gray-300 mb-3">
                                Existing Entries
                            </h2>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left border-b border-gray-700 text-gray-400">
                                        <th className="pb-2 pr-4">Player</th>
                                        <th className="pb-2 pr-4 text-green-400">+</th>
                                        <th className="pb-2 pr-4 text-red-400">−</th>
                                        <th className="pb-2 pr-4">Points</th>
                                        <th className="pb-2">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {entries.map((entry) => (
                                        <tr
                                            key={entry.userMatch.id}
                                            className="border-b border-gray-700/50"
                                        >
                                            <td className="py-3 pr-4">
                                                {entry.userMatch.userName}
                                            </td>
                                            <td className="py-3 pr-4 text-green-400 font-mono">
                                                {entry.userMatch.totalPlus}
                                            </td>
                                            <td className="py-3 pr-4 text-red-400 font-mono">
                                                {entry.userMatch.totalMinus}
                                            </td>
                                            <td className="py-3 pr-4 text-gray-400">
                                                {entry.points.length} point{entry.points.length !== 1 ? 's' : ''}
                                                {entry.goals.length > 0 && `, ${entry.goals.length} goal entry`}
                                                {entry.penalties.length > 0 && `, ${entry.penalties.length} penalty entry`}
                                            </td>
                                            <td className="py-3 flex gap-2">
                                                {isAuth && (
                                                    <>
                                                        <button
                                                            onClick={() => setManageEntry(entry)}
                                                            className="text-xs bg-cyan-700 hover:bg-cyan-600 px-3 py-1 rounded"
                                                        >
                                                            Manage
                                                        </button>
                                                        <button
                                                            onClick={() =>
                                                                void handleDelete(entry.userMatch.id)
                                                            }
                                                            className="text-xs bg-red-900 hover:bg-red-800 px-3 py-1 rounded"
                                                        >
                                                            Delete
                                                        </button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </section>
                    )}

                    {/* Users without an entry */}
                    {usersWithoutEntry.length > 0 && (
                        <section>
                            <h2 className="text-base font-semibold text-gray-300 mb-3">
                                Add Entry For…
                            </h2>
                            <div className="space-y-2">
                                {usersWithoutEntry.map((u) => (
                                    <div
                                        key={u.id}
                                        className="flex items-center justify-between bg-gray-800 rounded px-4 py-3"
                                    >
                                        <span className="text-sm">{u.name}</span>
                                        {isAuth && (
                                            <button
                                                onClick={() => void handleCreate(u.id)}
                                                disabled={creating === u.id}
                                                className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded disabled:opacity-50"
                                            >
                                                {creating === u.id ? 'Creating…' : '+ Create Entry'}
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {entries.length === 0 && usersWithoutEntry.length === 0 && (
                        <p className="text-gray-400 text-sm">No users are assigned to this season.</p>
                    )}
                </>
            )}

            {/* Manage modal */}
            {manageEntry && (
                <Modal
                    title={`Aggregated Points — ${manageEntry.userMatch.userName}`}
                    onClose={() => setManageEntry(null)}
                >
                    <UserMatchCard
                        userMatch={manageEntry.userMatch}
                        points={manageEntry.points}
                        goals={manageEntry.goals}
                        penalties={manageEntry.penalties}
                        roster={roster}
                        pointReasons={pointReasons}
                        isAuth={isAuth}
                        onChanged={() => void refreshManageEntry()}
                    />
                </Modal>
            )}
        </div>
    )
}
