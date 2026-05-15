import { useEffect, useState } from 'react'
import type { Season } from '../../types/season'
import type { User } from '../../types/user'
import type { UserPayout, CreateUserPayoutDto, UpdateUserPayoutDto } from '../../types/payout'
import apiClient from '../../services/apiClient'
import { cacheService } from '../../services/cacheService'
import Modal from '../Modal'
import { useTranslation } from 'react-i18next'
import LoadingSpinner from '../LoadingSpinner'
import SearchInput from '../SearchInput'
import Pagination from '../Pagination'
import useTable from '../../hooks/useTable'
import { useToast } from '../../context/ToastContext'
import { Pencil, Trash } from '@phosphor-icons/react'

interface Props {
    addOpen?: boolean
    onAddClose?: () => void
}

export default function CollectingTab({ addOpen, onAddClose }: Props) {
    const { t } = useTranslation()
    const toast = useToast()
    const [seasons, setSeasons] = useState<Season[]>([])
    const [users, setUsers] = useState<User[]>([])
    const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null)
    const [collections, setCollections] = useState<UserPayout[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const today = new Date().toISOString().split('T')[0]

    const [showAddModal, setShowAddModal] = useState(false)
    const [addForm, setAddForm] = useState<CreateUserPayoutDto>({
        userId: 0,
        amount: 0,
        paidOn: today,
    })

    const [editCollection, setEditCollection] = useState<UserPayout | null>(null)
    const [editForm, setEditForm] = useState<UpdateUserPayoutDto>({
        amount: 0,
        paidOn: today,
    })

    const { pageItems, totalFiltered, search, setSearch, currentPage, setCurrentPage } = useTable({
        data: collections,
        searchFields: (p) => [p.userName],
    })

    useEffect(() => {
        if (addOpen) {
            setShowAddModal(true)
            onAddClose?.()
        }
    }, [addOpen])

    useEffect(() => {
        Promise.all([
            cacheService.getSeasons(),
            cacheService.getUsers(),
        ])
            .then(([s, u]) => {
                const sorted = [...s].sort(
                    (a, b) => new Date(b.startedOn).getTime() - new Date(a.startedOn).getTime(),
                )
                setSeasons(sorted)
                setUsers(u)
                if (sorted.length > 0) setSelectedSeasonId(sorted[0].id)
            })
            .catch(() => setError(t('errors.failedToLoadSeasons')))
    }, [])

    const loadCollections = async (seasonId: number) => {
        setLoading(true)
        try {
            const data = await apiClient.get<UserPayout[]>(`/api/seasons/${seasonId}/payouts`)
            setCollections(data)
        } catch {
            setError(t('errors.failedToLoadPayouts'))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (selectedSeasonId) void loadCollections(selectedSeasonId)
        else setCollections([])
    }, [selectedSeasonId])

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedSeasonId) return
        try {
            await apiClient.post<UserPayout>(`/api/seasons/${selectedSeasonId}/payouts`, addForm)
            setShowAddModal(false)
            setAddForm({ userId: 0, amount: 0, paidOn: today })
            toast.success(t('toast.createSuccess'))
            await loadCollections(selectedSeasonId)
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    const openEdit = (collection: UserPayout) => {
        setEditCollection(collection)
        setEditForm({
            amount: collection.amount,
            paidOn: collection.paidOn.split('T')[0],
        })
    }

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editCollection || !selectedSeasonId) return
        try {
            await apiClient.put<UserPayout>(
                `/api/seasons/${selectedSeasonId}/payouts/${editCollection.id}`,
                editForm,
            )
            setEditCollection(null)
            toast.success(t('toast.saveSuccess'))
            await loadCollections(selectedSeasonId)
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    const handleDelete = async (id: number) => {
        if (!selectedSeasonId) return
        if (!confirm(t('admin.payouts.deleteConfirm'))) return
        try {
            await apiClient.delete(`/api/seasons/${selectedSeasonId}/payouts/${id}`)
            toast.success(t('toast.deleteSuccess'))
            await loadCollections(selectedSeasonId)
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    const totalAmount = collections.reduce((s, p) => s + p.amount, 0)

    return (
        <div>
            {error && <p className="text-danger mb-4">{error}</p>}

            <div className="mb-4">
                <select
                    value={selectedSeasonId ?? ''}
                    onChange={(e) =>
                        setSelectedSeasonId(e.target.value ? Number(e.target.value) : null)
                    }
                    className="bg-border border border-border rounded px-3 py-1 text-sm"
                >
                    <option value="">{t('admin.payouts.selectSeason')}</option>
                    {seasons.map((s) => (
                        <option key={s.id} value={s.id}>
                            {s.name}
                        </option>
                    ))}
                </select>
            </div>

            {!selectedSeasonId && (
                <p className="text-text-muted">{t('admin.payouts.selectSeasonPrompt')}</p>
            )}

            {selectedSeasonId && loading && <LoadingSpinner size="sm" inline />}

            {selectedSeasonId && !loading && (
                <>
                    <div className="mb-4">
                        <SearchInput value={search} onChange={setSearch} placeholder={t('common.search')} />
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-border overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-surface">
                                <tr className="text-left text-text-muted uppercase text-xs tracking-wider">
                                    <th className="px-4 py-3 font-medium w-1/3">{t('admin.payouts.player')}</th>
                                    <th className="px-4 py-3 font-medium text-right">{t('admin.payouts.amount')}</th>
                                    <th className="px-4 py-3 font-medium">{t('admin.payouts.paidOn')}</th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {collections.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="text-center py-6 text-text-muted/70">
                                            {t('admin.payouts.noPayouts')}
                                        </td>
                                    </tr>
                                ) : (
                                    pageItems.map((p) => (
                                        <tr key={p.id} className="hover:bg-surface/50 transition-colors group">
                                            <td className="px-4 py-3 font-medium">{p.userName}</td>
                                            <td className="px-4 py-3 text-right text-success font-mono">
                                                {p.amount.toFixed(2)} €
                                            </td>
                                            <td className="px-4 py-3 text-text-muted">
                                                {p.paidOn.split('T')[0]}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => openEdit(p)}
                                                        className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/10 rounded transition-colors"
                                                        title={t('common.edit')}
                                                    >
                                                        <Pencil size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => void handleDelete(p.id)}
                                                        className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded transition-colors"
                                                        title={t('common.delete')}
                                                    >
                                                        <Trash size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            {collections.length > 0 && (
                                <tfoot className="bg-surface border-t-2 border-border font-semibold text-sm">
                                    <tr>
                                        <td className="px-4 py-3 text-text-muted uppercase text-xs tracking-wider">{t('admin.payouts.total')}</td>
                                        <td className="px-4 py-3 text-right text-success font-mono">
                                            {totalAmount.toFixed(2)} €
                                        </td>
                                        <td colSpan={2}></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                    <Pagination
                        currentPage={currentPage}
                        totalItems={totalFiltered}
                        pageSize={20}
                        onPageChange={setCurrentPage}
                    />
                </>
            )}

            {showAddModal && (
                <Modal title={t('admin.payouts.addTitle')} onClose={() => setShowAddModal(false)}>
                    <form onSubmit={(e) => void handleAdd(e)} className="space-y-4">
                        <div>
                            <label className="block text-sm text-text-muted mb-1">{t('admin.payouts.player')}</label>
                            <select
                                required
                                value={addForm.userId || ''}
                                onChange={(e) =>
                                    setAddForm((f) => ({ ...f, userId: Number(e.target.value) }))
                                }
                                className="w-full bg-border border border-border rounded px-3 py-2 text-sm"
                            >
                                <option value="">{t('userStats.selectPlayer')}</option>
                                {users.map((u) => (
                                    <option key={u.id} value={u.id}>
                                        {u.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-text-muted mb-1">{t('admin.payouts.amountLabel')}</label>
                            <input
                                type="number"
                                step="0.01"
                                required
                                value={addForm.amount}
                                onChange={(e) =>
                                    setAddForm((f) => ({ ...f, amount: Number(e.target.value) }))
                                }
                                className="w-full bg-border border border-border rounded px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-text-muted mb-1">{t('admin.payouts.paidOn')}</label>
                            <input
                                type="date"
                                required
                                value={addForm.paidOn}
                                onChange={(e) =>
                                    setAddForm((f) => ({ ...f, paidOn: e.target.value }))
                                }
                                className="w-full bg-border border border-border rounded px-3 py-2 text-sm"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowAddModal(false)}
                                className="px-4 py-2 rounded bg-border hover:bg-border/80 text-sm"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 rounded bg-primary hover:bg-primary-hover text-sm"
                            >
                                {t('common.create')}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {editCollection && (
                <Modal
                    title={t('admin.payouts.editPayout', { name: editCollection.userName })}
                    onClose={() => setEditCollection(null)}
                >
                    <form onSubmit={(e) => void handleEdit(e)} className="space-y-4">
                        <div>
                            <label className="block text-sm text-text-muted mb-1">{t('admin.payouts.amountLabel')}</label>
                            <input
                                type="number"
                                step="0.01"
                                required
                                value={editForm.amount}
                                onChange={(e) =>
                                    setEditForm((f) => ({ ...f, amount: Number(e.target.value) }))
                                }
                                className="w-full bg-border border border-border rounded px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-text-muted mb-1">{t('admin.payouts.paidOn')}</label>
                            <input
                                type="date"
                                required
                                value={editForm.paidOn}
                                onChange={(e) =>
                                    setEditForm((f) => ({ ...f, paidOn: e.target.value }))
                                }
                                className="w-full bg-border border border-border rounded px-3 py-2 text-sm"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setEditCollection(null)}
                                className="px-4 py-2 rounded bg-border hover:bg-border/80 text-sm"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 rounded bg-primary hover:bg-primary-hover text-sm"
                            >
                                {t('common.save')}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    )
}
