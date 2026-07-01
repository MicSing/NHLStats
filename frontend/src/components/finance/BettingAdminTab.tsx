import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../../context/ToastContext'
import apiClient from '../../services/apiClient'

export default function BettingAdminTab() {
    const { t } = useTranslation()
    const { success, error } = useToast()
    const [running, setRunning] = useState(false)

    const recalculate = async () => {
        setRunning(true)
        try {
            const result = await apiClient.post<{ betsUpdated: number }>(
                '/api/admin/bets/recalculate-plus-minus-odds', {},
            )
            success(t('admin.betting.recalculateSuccess', { count: result.betsUpdated }))
        } catch {
            error(t('admin.betting.recalculateError'))
        } finally {
            setRunning(false)
        }
    }

    return (
        <div className="card p-4 max-w-xl space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-muted">
                {t('admin.betting.recalculateTitle')}
            </h3>
            <p className="text-sm text-text-muted">
                {t('admin.betting.recalculateDescription')}
            </p>
            <button
                onClick={() => void recalculate()}
                disabled={running}
                className="bg-primary hover:bg-primary-hover px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
            >
                {running ? t('common.saving') : t('admin.betting.recalculateButton')}
            </button>
        </div>
    )
}
