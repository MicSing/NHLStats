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
                <h1 className="text-2xl font-bold text-cyan-400">Money Config</h1>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-cyan-600 hover:bg-cyan-700 px-4 py-2 rounded text-sm font-medium"
                >
                    Add Config
                </button>
            </div>

            {/* Current config card */}
            {current && (
                <div className="bg-gray-800 rounded-lg p-4 mb-6 inline-flex gap-8">
                    <div>
                        <p className="text-xs text-gray-400 mb-1">Negative Point Value</p>
                        <p className="text-2xl font-bold text-orange-400">
                            −{current.negativePointValue.toFixed(2)} zł
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400 mb-1">Positive Point Value</p>
                        <p className="text-2xl font-bold text-cyan-400">
                            +{current.positivePointValue.toFixed(2)} zł
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400 mb-1">Effective From</p>
                        <p className="text-sm text-gray-300">
                            {new Date(current.effectiveFrom).toLocaleDateString()}
                        </p>
                    </div>
                </div>
            )}

            {/* History table */}
            <h2 className="text-lg font-semibold text-gray-300 mb-3">Rate History</h2>
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-left border-b border-gray-700 text-gray-400">
                        <th className="pb-2 pr-4">Effective From</th>
                        <th className="pb-2 pr-4">Negative (−)</th>
                        <th className="pb-2">Positive (+)</th>
                    </tr>
                </thead>
                <tbody>
                    {history.map((cfg) => (
                        <tr key={cfg.id} className="border-b border-gray-700/50">
                            <td className="py-3 pr-4">
                                {new Date(cfg.effectiveFrom).toLocaleDateString()}
                            </td>
                            <td className="py-3 pr-4 text-orange-300">
                                {cfg.negativePointValue.toFixed(2)} zł
                            </td>
                            <td className="py-3 text-cyan-300">
                                {cfg.positivePointValue.toFixed(2)} zł
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
                            <p className="text-orange-400 text-sm mb-3">{addError}</p>
                        )}

                        <label
                            htmlFor="mc-negative"
                            className="block text-sm mb-1 text-gray-300"
                        >
                            Negative Point Value (zł)
                        </label>
                        <input
                            id="mc-negative"
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 mb-3 text-white"
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
                            className="block text-sm mb-1 text-gray-300"
                        >
                            Positive Point Value (zł)
                        </label>
                        <input
                            id="mc-positive"
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 mb-3 text-white"
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
                            className="block text-sm mb-1 text-gray-300"
                        >
                            Effective From
                        </label>
                        <input
                            id="mc-effective-from"
                            type="date"
                            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 mb-4 text-white"
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
                                className="px-4 py-2 text-sm bg-gray-700 rounded"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 text-sm bg-cyan-600 hover:bg-cyan-700 rounded"
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
