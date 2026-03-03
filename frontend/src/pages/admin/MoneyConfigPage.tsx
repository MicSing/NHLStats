import { useEffect, useState } from 'react'
import type { MoneyConfig, CreateMoneyConfigDto } from '../../types/moneyConfig'
import apiClient from '../../services/apiClient'
import Modal from '../../components/Modal'

export default function MoneyConfigPage() {
    const [current, setCurrent] = useState<MoneyConfig | null>(null)
    const [history, setHistory] = useState<MoneyConfig[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showAddModal, setShowAddModal] = useState(false)
    const [addForm, setAddForm] = useState<CreateMoneyConfigDto>({
        negativePointValue: 0,
        positivePointValue: 0,
        effectiveFrom: new Date().toISOString().split('T')[0],
    })
    const [addError, setAddError] = useState<string | null>(null)

    const loadData = async () => {
        try {
            const [cur, hist] = await Promise.all([
                apiClient.get<MoneyConfig>('/api/moneyconfig/current'),
                apiClient.get<MoneyConfig[]>('/api/moneyconfig/history'),
            ])
            setCurrent(cur)
            setHistory(hist)
        } catch {
            setError('Failed to load money config')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void loadData()
    }, [])

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        setAddError(null)
        try {
            await apiClient.post<MoneyConfig>('/api/moneyconfig', addForm)
            setShowAddModal(false)
            setAddForm({
                negativePointValue: 0,
                positivePointValue: 0,
                effectiveFrom: new Date().toISOString().split('T')[0],
            })
            await loadData()
        } catch {
            setAddError('Failed to add config. Ensure EffectiveFrom is after the last entry.')
        }
    }

    if (loading) return <p>Loading…</p>
    if (error) return <p role="alert">{error}</p>

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-primary">Money Config</h1>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-primary hover:bg-primary-hover px-4 py-2 rounded text-sm font-medium"
                >
                    Add Config
                </button>
            </div>

            {/* Current config card */}
            {current && (
                <div className="bg-surface rounded-lg p-4 mb-6 inline-flex gap-8">
                    <div>
                        <p className="text-xs text-text-muted mb-1">Negative Point Value</p>
                        <p className="text-2xl font-bold text-warning">
                            −{current.negativePointValue.toFixed(2)} €
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-text-muted mb-1">Positive Point Value</p>
                        <p className="text-2xl font-bold text-primary">
                            +{current.positivePointValue.toFixed(2)} €
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-text-muted mb-1">Effective From</p>
                        <p className="text-sm text-text">
                            {new Date(current.effectiveFrom).toLocaleDateString()}
                        </p>
                    </div>
                </div>
            )}

            {/* History table */}
            <h2 className="text-lg font-semibold text-text mb-3">Rate History</h2>
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-left border-b border-border text-text-muted">
                        <th className="pb-2 pr-4">Effective From</th>
                        <th className="pb-2 pr-4">Negative (−)</th>
                        <th className="pb-2">Positive (+)</th>
                    </tr>
                </thead>
                <tbody>
                    {history.map((cfg) => (
                        <tr key={cfg.id} className="border-b border-border/50">
                            <td className="py-3 pr-4">
                                {new Date(cfg.effectiveFrom).toLocaleDateString()}
                            </td>
                            <td className="py-3 pr-4 text-warning">
                                {cfg.negativePointValue.toFixed(2)} €
                            </td>
                            <td className="py-3 text-primary/80">
                                {cfg.positivePointValue.toFixed(2)} €
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Add modal */}
            {showAddModal && (
                <Modal title="Add Money Config" onClose={() => setShowAddModal(false)}>
                    <form onSubmit={(e) => void handleAdd(e)}>
                        {addError && (
                            <p className="text-warning text-sm mb-3">{addError}</p>
                        )}

                        <label
                            htmlFor="mc-negative"
                            className="label"
                        >
                            Negative Point Value (€)
                        </label>
                        <input
                            id="mc-negative"
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full bg-border border border-border rounded px-3 py-2 mb-3 text-white"
                            value={addForm.negativePointValue}
                            onChange={(e) =>
                                setAddForm((f) => ({
                                    ...f,
                                    negativePointValue: parseFloat(e.target.value) || 0,
                                }))
                            }
                            required
                        />

                        <label
                            htmlFor="mc-positive"
                            className="label"
                        >
                            Positive Point Value (€)
                        </label>
                        <input
                            id="mc-positive"
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full bg-border border border-border rounded px-3 py-2 mb-3 text-white"
                            value={addForm.positivePointValue}
                            onChange={(e) =>
                                setAddForm((f) => ({
                                    ...f,
                                    positivePointValue: parseFloat(e.target.value) || 0,
                                }))
                            }
                            required
                        />

                        <label
                            htmlFor="mc-effective-from"
                            className="label"
                        >
                            Effective From
                        </label>
                        <input
                            id="mc-effective-from"
                            type="date"
                            className="w-full bg-border border border-border rounded px-3 py-2 mb-4 text-white"
                            value={addForm.effectiveFrom}
                            onChange={(e) =>
                                setAddForm((f) => ({ ...f, effectiveFrom: e.target.value }))
                            }
                            required
                        />

                        <div className="flex gap-2 justify-end">
                            <button
                                type="button"
                                onClick={() => setShowAddModal(false)}
                                className="btn-ghost text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover rounded"
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
