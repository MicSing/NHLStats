import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SeasonDetail } from '../../types/season'
import apiClient from '../../services/apiClient'
import { useToast } from '../../context/ToastContext'
import Modal from '../Modal'
import LoadingSpinner from '../LoadingSpinner'
import { TableCard, TableHead, ActionCell } from './SeasonPrimitives'

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

export interface ManualPointsTabProps {
    seasonId: number
    seasonDetail: SeasonDetail | null
}

export default function ManualPointsTab({ seasonId, seasonDetail }: ManualPointsTabProps) {
    const { t } = useTranslation()
    const toast = useToast()
    const [entries, setEntries] = useState<EnrichedEntry[]>([])
    const [loading, setLoading] = useState(false)
    const [creating, setCreating] = useState<number | null>(null)
    const [manageEntry, setManageEntry] = useState<EnrichedEntry | null>(null)
    const [editValues, setEditValues] = useState({ totalPlus: 0, totalMinus: 0, matchesPlayed: 0 })
    const [saving, setSaving] = useState(false)

    const loadEntries = async (id: number, detail: SeasonDetail | null) => {
        if (!detail) return
        setLoading(true)
        try {
            const aggregated = await apiClient.get<AggregatedSeasonData[]>(
                `/api/seasons/${id}/aggregated-data`,
            )
            const nameById = new Map(detail.users.map((u) => [u.id, u.name]))
            setEntries(
                aggregated.map((agg) => ({
                    aggregatedData: agg,
                    userName: nameById.get(agg.userId) ?? `User ${agg.userId}`,
                })),
            )
        } catch {
            // silently fail
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void loadEntries(seasonId, seasonDetail)
    }, [seasonId, seasonDetail])

    useEffect(() => {
        if (manageEntry) {
            setEditValues({
                totalPlus: manageEntry.aggregatedData.totalPlus,
                totalMinus: manageEntry.aggregatedData.totalMinus,
                matchesPlayed: manageEntry.aggregatedData.matchesPlayed,
            })
        }
    }, [manageEntry])

    const handleCreate = async (userId: number) => {
        setCreating(userId)
        try {
            await apiClient.post(
                `/api/users/${userId}/seasons/${seasonId}/aggregated-data`,
                { userId, seasonId, totalPlus: 0, totalMinus: 0, matchesPlayed: 0 },
            )
            toast.success(t('toast.createSuccess'))
            await loadEntries(seasonId, seasonDetail)
        } catch {
            toast.error(t('toast.operationFailed'))
        } finally {
            setCreating(null)
        }
    }

    const handleDelete = async (userId: number) => {
        if (!window.confirm(t('admin.aggregated.deleteConfirm'))) return
        try {
            await apiClient.delete(
                `/api/users/${userId}/seasons/${seasonId}/aggregated-data`,
            )
            setManageEntry(null)
            toast.success(t('toast.deleteSuccess'))
            await loadEntries(seasonId, seasonDetail)
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    const handleSave = async () => {
        if (!manageEntry) return
        const isValidNonNeg = (v: number) => Number.isFinite(v) && v >= 0
        if (
            !isValidNonNeg(editValues.totalPlus) ||
            !isValidNonNeg(editValues.totalMinus) ||
            !isValidNonNeg(editValues.matchesPlayed)
        ) {
            toast.error(t('errors.invalidInput'))
            return
        }
        setSaving(true)
        try {
            await apiClient.put(
                `/api/users/${manageEntry.aggregatedData.userId}/seasons/${seasonId}/aggregated-data`,
                editValues,
            )
            toast.success(t('toast.saveSuccess'))
            await loadEntries(seasonId, seasonDetail)
            setManageEntry(null)
        } catch {
            toast.error(t('toast.operationFailed'))
        } finally {
            setSaving(false)
        }
    }

    const usersWithEntry = new Set(entries.map((e) => e.aggregatedData.userId))
    const usersWithoutEntry = seasonDetail?.users.filter((u) => !usersWithEntry.has(u.id)) ?? []

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold">{t('admin.aggregated.title')}</h2>
                <p className="text-sm text-text-muted mt-1">{t('admin.aggregated.description')}</p>
            </div>

            {loading ? (
                <LoadingSpinner size="sm" inline />
            ) : (
                <>
                    {entries.length > 0 && (
                        <TableCard>
                            <TableHead
                                columns={[
                                    t('common.player'),
                                    '+',
                                    '−',
                                    t('admin.aggregated.matchesPlayed'),
                                    t('common.actions'),
                                ]}
                            />
                            <tbody className="text-sm">
                                {entries.map((entry) => (
                                    <tr
                                        key={entry.aggregatedData.id}
                                        className="border-b border-border/50 last:border-0 hover:bg-border/20 transition-colors group"
                                    >
                                        <td className="p-4">{entry.userName}</td>
                                        <td className="p-4 text-success font-mono">
                                            {entry.aggregatedData.totalPlus}
                                        </td>
                                        <td className="p-4 text-danger font-mono">
                                            {entry.aggregatedData.totalMinus}
                                        </td>
                                        <td className="p-4 font-mono">
                                            {entry.aggregatedData.matchesPlayed}
                                        </td>
                                        <ActionCell
                                            onEdit={() => setManageEntry(entry)}
                                            onDelete={() =>
                                                void handleDelete(entry.aggregatedData.userId)
                                            }
                                            editTitle={t('admin.aggregated.manage')}
                                            deleteTitle={t('common.delete')}
                                        />
                                    </tr>
                                ))}
                            </tbody>
                        </TableCard>
                    )}

                    {usersWithoutEntry.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-text mb-3">
                                {t('admin.aggregated.addEntryFor')}
                            </h3>
                            <div className="space-y-2">
                                {usersWithoutEntry.map((u) => (
                                    <div
                                        key={u.id}
                                        className="flex items-center justify-between bg-surface border border-border rounded px-4 py-3"
                                    >
                                        <span className="text-sm">{u.name}</span>
                                        <button
                                            onClick={() => void handleCreate(u.id)}
                                            disabled={creating === u.id}
                                            className="text-xs bg-border hover:bg-border/80 px-3 py-1 rounded disabled:opacity-50"
                                        >
                                            {creating === u.id
                                                ? t('common.creating')
                                                : t('admin.aggregated.createEntry')}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {entries.length === 0 && usersWithoutEntry.length === 0 && (
                        <p className="text-text-muted text-sm">
                            {t('admin.aggregated.noUsers')}
                        </p>
                    )}
                </>
            )}

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
                                    const v = Number(e.target.value)
                                    if (!isNaN(v))
                                        setEditValues((prev) => ({
                                            ...prev,
                                            totalPlus: Math.max(0, v),
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
                                    const v = Number(e.target.value)
                                    if (!isNaN(v))
                                        setEditValues((prev) => ({
                                            ...prev,
                                            totalMinus: Math.max(0, v),
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
                                    const v = Number(e.target.value)
                                    if (!isNaN(v))
                                        setEditValues((prev) => ({
                                            ...prev,
                                            matchesPlayed: Math.max(0, v),
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
