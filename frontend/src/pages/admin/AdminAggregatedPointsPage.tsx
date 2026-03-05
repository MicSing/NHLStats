import { useEffect, useState } from 'react'
import type { Season, SeasonDetail } from '../../types/season'
import type { UserMatch, UserMatchPoint, UserMatchGoal, UserMatchPenalty } from '../../types/userMatch'
import type { RosterPlayer } from '../../types/roster'
import type { PointReason } from '../../types/pointReason'
import apiClient from '../../services/apiClient'
import Modal from '../../components/Modal'
import UserMatchCard from '../../components/UserMatchCard'
import { useAuth } from '../../context/AuthContext'
import { useTranslation } from 'react-i18next'

interface EnrichedEntry {
    userMatch: UserMatch
    points: UserMatchPoint[]
    goals: UserMatchGoal[]
    penalties: UserMatchPenalty[]
}

export default function AdminAggregatedPointsPage() {
    const { t } = useTranslation()
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
            .catch(() => setError(t('errors.failedToLoadSeasons')))
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
            setError(t('errors.failedToLoadEntries'))
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
            setError(e instanceof Error ? e.message : t('errors.failedToCreateEntry'))
        } finally {
            setCreating(null)
        }
    }

    const handleDelete = async (userMatchId: number) => {
        if (!window.confirm(t('admin.aggregated.deleteConfirm'))) return
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

    if (loadingSeasons) return <p>{t('common.loading')}</p>

    // Users that don't yet have an aggregated entry
    const usersWithEntry = new Set(entries.map((e) => e.userMatch.userId))
    const usersWithoutEntry = seasonDetail?.users.filter((u) => !usersWithEntry.has(u.id)) ?? []

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-primary">{t('admin.aggregated.title')}</h1>
            </div>

            <p className="text-sm text-text-muted mb-6">
                {t('admin.aggregated.description')}
            </p>

            {/* Season selector */}
            <div className="mb-6">
                <label className="label">{t('admin.aggregated.season')}</label>
                <select
                    value={selectedSeasonId}
                    onChange={(e) =>
                        handleSeasonChange(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="bg-border border border-border rounded px-3 py-2 text-sm text-white min-w-48"
                >
                    <option value="">{t('admin.aggregated.selectSeason')}</option>
                    {seasons.map((s) => (
                        <option key={s.id} value={s.id}>
                            {s.name}
                        </option>
                    ))}
                </select>
            </div>

            {error && <p className="text-danger text-sm mb-4">{t('common.error')}: {error}</p>}

            {selectedSeasonId !== '' && loadingEntries && <p>{t('admin.aggregated.loadingEntries')}</p>}

            {selectedSeasonId !== '' && !loadingEntries && seasonDetail && (
                <>
                    {/* Existing entries */}
                    {entries.length > 0 && (
                        <section className="mb-8">
                            <h2 className="text-base font-semibold text-text mb-3">
                                {t('admin.aggregated.existingEntries')}
                            </h2>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left border-b border-border text-text-muted">
                                        <th className="pb-2 pr-4">{t('common.player')}</th>
                                        <th className="pb-2 pr-4 text-success">+</th>
                                        <th className="pb-2 pr-4 text-danger">−</th>
                                        <th className="pb-2 pr-4">Points</th>
                                        <th className="pb-2">{t('common.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {entries.map((entry) => (
                                        <tr
                                            key={entry.userMatch.id}
                                            className="border-b border-border/50"
                                        >
                                            <td className="py-3 pr-4">
                                                {entry.userMatch.userName}
                                            </td>
                                            <td className="py-3 pr-4 text-success font-mono">
                                                {entry.userMatch.totalPlus}
                                            </td>
                                            <td className="py-3 pr-4 text-danger font-mono">
                                                {entry.userMatch.totalMinus}
                                            </td>
                                            <td className="py-3 pr-4 text-text-muted">
                                                {t('admin.aggregated.pointEntries', { count: entry.points.length })}
                                                {entry.goals.length > 0 && `, ${t('admin.aggregated.goalEntry', { count: entry.goals.length })}`}
                                                {entry.penalties.length > 0 && `, ${t('admin.aggregated.penaltyEntry', { count: entry.penalties.length })}`}
                                            </td>
                                            <td className="py-3 flex gap-2">
                                                {isAuth && (
                                                    <>
                                                        <button
                                                            onClick={() => setManageEntry(entry)}
                                                            className="text-xs bg-primary hover:bg-primary-hover px-3 py-1 rounded"
                                                        >
                                                            {t('admin.aggregated.manage')}
                                                        </button>
                                                        <button
                                                            onClick={() =>
                                                                void handleDelete(entry.userMatch.id)
                                                            }
                                                            className="text-xs bg-red-900 hover:bg-red-800 px-3 py-1 rounded"
                                                        >
                                                            {t('common.delete')}
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
                            <h2 className="text-base font-semibold text-text mb-3">
                                {t('admin.aggregated.addEntryFor')}
                            </h2>
                            <div className="space-y-2">
                                {usersWithoutEntry.map((u) => (
                                    <div
                                        key={u.id}
                                        className="flex items-center justify-between bg-surface rounded px-4 py-3"
                                    >
                                        <span className="text-sm">{u.name}</span>
                                        {isAuth && (
                                            <button
                                                onClick={() => void handleCreate(u.id)}
                                                disabled={creating === u.id}
                                                className="text-xs bg-border hover:bg-border/80 px-3 py-1 rounded disabled:opacity-50"
                                            >
                                                {creating === u.id ? t('common.creating') : t('admin.aggregated.createEntry')}
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {entries.length === 0 && usersWithoutEntry.length === 0 && (
                        <p className="text-text-muted text-sm">{t('admin.aggregated.noUsers')}</p>
                    )}
                </>
            )}

            {/* Manage modal */}
            {manageEntry && (
                <Modal
                    title={t('admin.aggregated.manageTitle', { name: manageEntry.userMatch.userName })}
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
