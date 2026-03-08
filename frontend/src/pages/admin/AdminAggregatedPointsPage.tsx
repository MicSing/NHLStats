import { useEffect, useState } from 'react'
import type { Season, SeasonDetail } from '../../types/season'
import apiClient from '../../services/apiClient'
import { cacheService } from '../../services/cacheService'
import Modal from '../../components/Modal'
import { useAuth } from '../../context/AuthContext'
import { useTranslation } from 'react-i18next'
import LoadingSpinner from '../../components/LoadingSpinner'
import { useToast } from '../../context/ToastContext'

interface AggregatedSeasonData {
    id: number
    userId: number
    seasonId: number
    totalPlus: number
    totalMinus: number
    matchesPlayed: number
}

interface EnrichedEntry {
    aggregatedData: AggregatedSeasonData
    userName: string
}

export default function AdminAggregatedPointsPage() {
    const { t } = useTranslation()
    const toast = useToast()
    const { token } = useAuth()
    const isAuth = !!token

    const [seasons, setSeasons] = useState<Season[]>([])
    const [selectedSeasonId, setSelectedSeasonId] = useState<number | ''>('')
    const [seasonDetail, setSeasonDetail] = useState<SeasonDetail | null>(null)
    const [entries, setEntries] = useState<EnrichedEntry[]>([])
    const [loadingSeasons, setLoadingSeasons] = useState(true)
    const [loadingEntries, setLoadingEntries] = useState(false)
    const [creating, setCreating] = useState<number | null>(null) // userId being created
    const [error, setError] = useState<string | null>(null)
    const [manageEntry, setManageEntry] = useState<EnrichedEntry | null>(null)
    const [editValues, setEditValues] = useState({ totalPlus: 0, totalMinus: 0, matchesPlayed: 0 })
    const [saving, setSaving] = useState(false)

    const isValidNonNegative = (value: number) => Number.isFinite(value) && value >= 0

    // Load seasons
    useEffect(() => {
        cacheService
            .getSeasons()
            .then((s) => {
                setSeasons(s)
            })
            .catch(() => setError(t('errors.failedToLoadSeasons')))
            .finally(() => setLoadingSeasons(false))
    }, [t])

    const loadEntries = async (seasonId: number) => {
        setLoadingEntries(true)
        setError(null)
        try {
            const [detail, aggregated] = await Promise.all([
                apiClient.get<SeasonDetail>(`/api/seasons/${seasonId}`),
                apiClient.get<AggregatedSeasonData[]>(`/api/seasons/${seasonId}/aggregated-data`),
            ])
            setSeasonDetail(detail)

            const nameById = new Map(detail.users.map((user) => [user.id, user.name]))
            const enriched = aggregated.map((agg) => {
                const userName = nameById.get(agg.userId)
                if (!userName) {
                    console.warn(`Missing user name for aggregated data user ${agg.userId}`)
                }
                return { aggregatedData: agg, userName: userName ?? `User ${agg.userId}` }
            })
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
            await apiClient.post(
                `/api/users/${userId}/seasons/${selectedSeasonId}/aggregated-data`,
                { userId, seasonId: selectedSeasonId, totalPlus: 0, totalMinus: 0, matchesPlayed: 0 }
            )
            toast.success(t('toast.createSuccess'))
            await loadEntries(selectedSeasonId as number)
        } catch {
            toast.error(t('toast.operationFailed'))
        } finally {
            setCreating(null)
        }
    }

    const handleDelete = async (userId: number) => {
        if (!window.confirm(t('admin.aggregated.deleteConfirm'))) return
        if (selectedSeasonId === '') return
        try {
            await apiClient.delete(`/api/users/${userId}/seasons/${selectedSeasonId}/aggregated-data`)
            setManageEntry(null)
            toast.success(t('toast.deleteSuccess'))
            await loadEntries(selectedSeasonId)
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    const handleSave = async () => {
        if (!manageEntry || selectedSeasonId === '') return
        if (!isValidNonNegative(editValues.totalPlus)
            || !isValidNonNegative(editValues.totalMinus)
            || !isValidNonNegative(editValues.matchesPlayed)) {
            toast.error(t('errors.invalidInput'))
            return
        }
        setSaving(true)
        try {
            await apiClient.put(
                `/api/users/${manageEntry.aggregatedData.userId}/seasons/${selectedSeasonId}/aggregated-data`,
                {
                    totalPlus: editValues.totalPlus,
                    totalMinus: editValues.totalMinus,
                    matchesPlayed: editValues.matchesPlayed,
                }
            )
            toast.success(t('toast.saveSuccess'))
            await loadEntries(selectedSeasonId as number)
            setManageEntry(null)
        } catch {
            toast.error(t('toast.operationFailed'))
        } finally {
            setSaving(false)
        }
    }

    // Initialize edit values when modal opens
    useEffect(() => {
        if (manageEntry) {
            setEditValues({
                totalPlus: manageEntry.aggregatedData.totalPlus,
                totalMinus: manageEntry.aggregatedData.totalMinus,
                matchesPlayed: manageEntry.aggregatedData.matchesPlayed,
            })
        }
    }, [manageEntry])

    if (loadingSeasons) return <LoadingSpinner />

    // Users that don't yet have an aggregated entry
    const usersWithEntry = new Set(entries.map((e) => e.aggregatedData.userId))
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

            {selectedSeasonId !== '' && loadingEntries && <LoadingSpinner size="sm" inline />}

            {selectedSeasonId !== '' && !loadingEntries && seasonDetail && (
                <>
                    {/* Existing entries */}
                    {entries.length > 0 && (
                        <section className="mb-8">
                            <h2 className="text-base font-semibold text-text mb-3">
                                {t('admin.aggregated.existingEntries')}
                            </h2>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left border-b border-border text-text-muted">
                                            <th className="pb-2 pr-4">{t('common.player')}</th>
                                            <th className="pb-2 pr-4 text-success">+</th>
                                            <th className="pb-2 pr-4 text-danger">−</th>
                                            <th className="pb-2 pr-4">{t('admin.aggregated.matchesPlayed')}</th>
                                            <th className="pb-2">{t('common.actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {entries.map((entry) => (
                                            <tr
                                                key={entry.aggregatedData.id}
                                                className="border-b border-border/50"
                                            >
                                                <td className="py-3 pr-4">
                                                    {entry.userName}
                                                </td>
                                                <td className="py-3 pr-4 text-success font-mono">
                                                    {entry.aggregatedData.totalPlus}
                                                </td>
                                                <td className="py-3 pr-4 text-danger font-mono">
                                                    {entry.aggregatedData.totalMinus}
                                                </td>
                                                <td className="py-3 pr-4 font-mono">
                                                    {entry.aggregatedData.matchesPlayed}
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
                                                                    void handleDelete(entry.aggregatedData.userId)
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
                            </div>
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
                    title={t('admin.aggregated.manageTitle', { name: manageEntry.userName })}
                    onClose={() => setManageEntry(null)}
                >
                    <div className="space-y-4">
                        <div>
                            <label className="label text-success">
                                {t('admin.aggregated.totalPositive')}
                            </label>
                            <input
                                type="number"
                                min={0}
                                value={editValues.totalPlus}
                                onChange={(e) => {
                                    const parsed = Number(e.target.value)
                                    if (Number.isNaN(parsed)) return
                                    setEditValues((current) => ({
                                        ...current,
                                        totalPlus: Math.max(0, parsed),
                                    }))
                                }}
                                className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-white"
                            />
                        </div>
                        <div>
                            <label className="label text-danger">
                                {t('admin.aggregated.totalNegative')}
                            </label>
                            <input
                                type="number"
                                min={0}
                                value={editValues.totalMinus}
                                onChange={(e) => {
                                    const parsed = Number(e.target.value)
                                    if (Number.isNaN(parsed)) return
                                    setEditValues((current) => ({
                                        ...current,
                                        totalMinus: Math.max(0, parsed),
                                    }))
                                }}
                                className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-white"
                            />
                        </div>
                        <div>
                            <label className="label">
                                {t('admin.aggregated.matchesPlayed')}
                            </label>
                            <input
                                type="number"
                                min={0}
                                value={editValues.matchesPlayed}
                                onChange={(e) => {
                                    const parsed = Number(e.target.value)
                                    if (Number.isNaN(parsed)) return
                                    setEditValues((current) => ({
                                        ...current,
                                        matchesPlayed: Math.max(0, parsed),
                                    }))
                                }}
                                className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-white"
                            />
                        </div>
                        <div className="flex gap-2 pt-4">
                            <button
                                onClick={() => void handleSave()}
                                disabled={saving}
                                className="flex-1 bg-primary hover:bg-primary-hover px-3 py-2 rounded text-sm disabled:opacity-50"
                            >
                                {saving ? t('common.saving') : t('common.save')}
                            </button>
                            <button
                                onClick={() => setManageEntry(null)}
                                className="flex-1 bg-border hover:bg-border/80 px-3 py-2 rounded text-sm"
                            >
                                {t('common.cancel')}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    )
}
