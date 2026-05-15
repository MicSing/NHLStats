import { useEffect, useState } from 'react'
import type { MoneyConfig, CreateMoneyConfigDto } from '../../types/moneyConfig'
import apiClient from '../../services/apiClient'
import Modal from '../Modal'
import { useTranslation } from 'react-i18next'
import LoadingSpinner from '../LoadingSpinner'
import ErrorMessage from '../ErrorMessage'
import { useToast } from '../../context/ToastContext'

interface Props {
    addOpen?: boolean
    onAddClose?: () => void
}

export default function MoneyConfigTab({ addOpen, onAddClose }: Props) {
    const { t } = useTranslation()
    const toast = useToast()
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

    useEffect(() => {
        if (addOpen) {
            setShowAddModal(true)
            onAddClose?.()
        }
    }, [addOpen])

    const loadData = async () => {
        try {
            const [cur, hist] = await Promise.all([
                apiClient.get<MoneyConfig>('/api/moneyconfig/current'),
                apiClient.get<MoneyConfig[]>('/api/moneyconfig/history'),
            ])
            setCurrent(cur)
            setHistory(hist)
        } catch {
            setError(t('errors.failedToLoadMoneyConfig'))
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
            toast.success(t('toast.createSuccess'))
            await loadData()
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    if (loading) return <LoadingSpinner />
    if (error) return <ErrorMessage message={error} onRetry={() => void loadData()} />

    return (
        <div>
            {current && (
                <div className="bg-surface rounded-lg p-4 mb-6 inline-flex gap-8">
                    <div>
                        <p className="text-xs text-text-muted mb-1">{t('admin.moneyConfig.negativePointValue')}</p>
                        <p className="text-2xl font-bold text-warning">
                            −{current.negativePointValue.toFixed(2)} €
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-text-muted mb-1">{t('admin.moneyConfig.positivePointValue')}</p>
                        <p className="text-2xl font-bold text-primary">
                            +{current.positivePointValue.toFixed(2)} €
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-text-muted mb-1">{t('admin.moneyConfig.effectiveFrom')}</p>
                        <p className="text-sm text-text">
                            {new Date(current.effectiveFrom).toLocaleDateString()}
                        </p>
                    </div>
                </div>
            )}

            <h2 className="text-lg font-semibold text-text mb-3">{t('admin.moneyConfig.rateHistory')}</h2>
            <div className="overflow-x-auto rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-surface">
                        <tr className="text-left text-text-muted uppercase text-xs tracking-wider">
                            <th className="px-4 py-3 font-medium">{t('admin.moneyConfig.effectiveFrom')}</th>
                            <th className="px-4 py-3 font-medium">{t('admin.moneyConfig.negative')}</th>
                            <th className="px-4 py-3 font-medium">{t('admin.moneyConfig.positive')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {history.map((cfg) => (
                            <tr key={cfg.id} className="hover:bg-surface/50 transition-colors">
                                <td className="px-4 py-3">
                                    {new Date(cfg.effectiveFrom).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3 text-warning">
                                    {cfg.negativePointValue.toFixed(2)} €
                                </td>
                                <td className="px-4 py-3 text-primary/80">
                                    {cfg.positivePointValue.toFixed(2)} €
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showAddModal && (
                <Modal title={t('admin.moneyConfig.addTitle')} onClose={() => setShowAddModal(false)}>
                    <form onSubmit={(e) => void handleAdd(e)}>
                        {addError && (
                            <p className="text-warning text-sm mb-3">{addError}</p>
                        )}

                        <label htmlFor="mc-negative" className="label">
                            {t('admin.moneyConfig.negativeLabel')}
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

                        <label htmlFor="mc-positive" className="label">
                            {t('admin.moneyConfig.positiveLabel')}
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

                        <label htmlFor="mc-effective-from" className="label">
                            {t('admin.moneyConfig.effectiveFrom')}
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
                                {t('common.cancel')}
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover rounded"
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
