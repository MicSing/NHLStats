import { useEffect, useState } from 'react'
import type { Season } from '../../types/season'
import type { User } from '../../types/user'
import type { UserPayout, CreateUserPayoutDto, UpdateUserPayoutDto } from '../../types/payout'
import apiClient from '../../services/apiClient'
import Modal from '../../components/Modal'

export default function PayoutsPage() {
    const [seasons, setSeasons] = useState<Season[]>([])
    const [users, setUsers] = useState<User[]>([])
    const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null)
    const [payouts, setPayouts] = useState<UserPayout[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const today = new Date().toISOString().split('T')[0]

    // Add modal
    const [showAddModal, setShowAddModal] = useState(false)
    const [addForm, setAddForm] = useState<CreateUserPayoutDto>({
        userId: 0,
        amount: 0,
        paidOn: today,
    })

    // Edit modal
    const [editPayout, setEditPayout] = useState<UserPayout | null>(null)
    const [editForm, setEditForm] = useState<UpdateUserPayoutDto>({
        amount: 0,
        paidOn: today,
    })

    useEffect(() => {
        Promise.all([
            apiClient.get<Season[]>('/api/seasons'),
            apiClient.get<User[]>('/api/users'),
        ])
            .then(([s, u]) => {
                const sorted = [...s].sort(
                    (a, b) => new Date(b.startedOn).getTime() - new Date(a.startedOn).getTime(),
                )
                setSeasons(sorted)
                setUsers(u)
                if (sorted.length > 0) setSelectedSeasonId(sorted[0].id)
            })
            .catch(() => setError('Failed to load data'))
    }, [])

    const loadPayouts = async (seasonId: number) => {
        setLoading(true)
        try {
            const data = await apiClient.get<UserPayout[]>(`/api/seasons/${seasonId}/payouts`)
            setPayouts(data)
        } catch {
            setError('Failed to load payouts')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (selectedSeasonId) void loadPayouts(selectedSeasonId)
        else setPayouts([])
    }, [selectedSeasonId])

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedSeasonId) return
        await apiClient.post<UserPayout>(`/api/seasons/${selectedSeasonId}/payouts`, addForm)
        setShowAddModal(false)
        setAddForm({ userId: 0, amount: 0, paidOn: today })
        await loadPayouts(selectedSeasonId)
    }

    const openEdit = (payout: UserPayout) => {
        setEditPayout(payout)
        setEditForm({
            amount: payout.amount,
            paidOn: payout.paidOn.split('T')[0],
        })
    }

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editPayout || !selectedSeasonId) return
        await apiClient.put<UserPayout>(
            `/api/seasons/${selectedSeasonId}/payouts/${editPayout.id}`,
            editForm,
        )
        setEditPayout(null)
        await loadPayouts(selectedSeasonId)
    }

    const handleDelete = async (id: number) => {
        if (!selectedSeasonId) return
        if (!confirm('Delete this payout?')) return
        await apiClient.delete(`/api/seasons/${selectedSeasonId}/payouts/${id}`)
        await loadPayouts(selectedSeasonId)
    }

    const totalAmount = payouts.reduce((s, p) => s + p.amount, 0)

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-primary">Payouts</h1>
                <div className="flex items-center gap-3">
                    <select
                        value={selectedSeasonId ?? ''}
                        onChange={(e) =>
                            setSelectedSeasonId(e.target.value ? Number(e.target.value) : null)
                        }
                        className="bg-border border border-border rounded px-3 py-1 text-sm"
                    >
                        <option value="">Select season…</option>
                        {seasons.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name}
                            </option>
                        ))}
                    </select>
                    {selectedSeasonId && (
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="bg-primary hover:bg-primary-hover px-3 py-1 rounded text-sm"
                        >
                            + Add Payout
                        </button>
                    )}
                </div>
            </div>

            {error && <p className="text-danger mb-4">{error}</p>}

            {!selectedSeasonId && (
                <p className="text-text-muted">Select a season to view payouts.</p>
            )}

            {selectedSeasonId && loading && <p className="text-text-muted">Loading…</p>}

            {selectedSeasonId && !loading && (
                <>
                    <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="w-full text-sm">
                            <thead className="bg-surface text-text uppercase text-xs tracking-wider">
                                <tr>
                                    <th className="text-left px-4 py-3">Player</th>
                                    <th className="text-right px-4 py-3">Amount</th>
                                    <th className="text-left px-4 py-3">Paid On</th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {payouts.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={4}
                                            className="text-center py-6 text-text-muted/70"
                                        >
                                            No payouts for this season.
                                        </td>
                                    </tr>
                                ) : (
                                    payouts.map((p) => (
                                        <tr
                                            key={p.id}
                                            className="bg-bg hover:bg-surface transition-colors"
                                        >
                                            <td className="px-4 py-3 font-medium">{p.userName}</td>
                                            <td className="px-4 py-3 text-right text-success">
                                                {p.amount.toFixed(2)} €
                                            </td>
                                            <td className="px-4 py-3 text-text">
                                                {p.paidOn.split('T')[0]}
                                            </td>
                                            <td className="px-4 py-3 text-right space-x-2">
                                                <button
                                                    onClick={() => openEdit(p)}
                                                    className="text-primary hover:text-primary/80 text-xs"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => void handleDelete(p.id)}
                                                    className="text-danger hover:text-danger/80 text-xs"
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            {payouts.length > 0 && (
                                <tfoot className="bg-surface border-t-2 border-border font-semibold text-sm">
                                    <tr>
                                        <td className="px-4 py-3 text-text">Total</td>
                                        <td className="px-4 py-3 text-right text-success">
                                            {totalAmount.toFixed(2)} €
                                        </td>
                                        <td colSpan={2}></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </>
            )}

            {/* Add modal */}
            {showAddModal && (
                <Modal title="Add Payout" onClose={() => setShowAddModal(false)}>
                    <form onSubmit={(e) => void handleAdd(e)} className="space-y-4">
                        <div>
                            <label className="block text-sm text-text-muted mb-1">Player</label>
                            <select
                                required
                                value={addForm.userId || ''}
                                onChange={(e) =>
                                    setAddForm((f) => ({ ...f, userId: Number(e.target.value) }))
                                }
                                className="w-full bg-border border border-border rounded px-3 py-2 text-sm"
                            >
                                <option value="">Select player…</option>
                                {users.map((u) => (
                                    <option key={u.id} value={u.id}>
                                        {u.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-text-muted mb-1">Amount (€)</label>
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
                            <label className="block text-sm text-text-muted mb-1">Paid On</label>
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
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 rounded bg-primary hover:bg-primary-hover text-sm"
                            >
                                Add
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Edit modal */}
            {editPayout && (
                <Modal
                    title={`Edit Payout — ${editPayout.userName}`}
                    onClose={() => setEditPayout(null)}
                >
                    <form onSubmit={(e) => void handleEdit(e)} className="space-y-4">
                        <div>
                            <label className="block text-sm text-text-muted mb-1">Amount (€)</label>
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
                            <label className="block text-sm text-text-muted mb-1">Paid On</label>
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
                                onClick={() => setEditPayout(null)}
                                className="px-4 py-2 rounded bg-border hover:bg-border/80 text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 rounded bg-primary hover:bg-primary-hover text-sm"
                            >
                                Save
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    )
}
