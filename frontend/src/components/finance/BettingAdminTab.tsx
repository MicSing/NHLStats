import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../../context/ToastContext'
import apiClient from '../../services/apiClient'

type RunningAction = 'correlated' | 'upcoming' | 'historical' | null

const CURRENT_FORMULA_VERSION = '2.0'
const LEGACY_FORMULA_VERSION = '1.0'

export default function BettingAdminTab() {
    const { t } = useTranslation()
    const { success, error } = useToast()
    const [running, setRunning] = useState<RunningAction>(null)
    const [targetVersion, setTargetVersion] = useState(CURRENT_FORMULA_VERSION)
    const busy = running !== null

    const recalculateCorrelated = async () => {
        setRunning('correlated')
        try {
            const result = await apiClient.post<{ betsUpdated: number }>(
                '/api/admin/bets/recalculate-correlated-odds', {},
            )
            success(t('admin.betting.recalculateSuccess', { count: result.betsUpdated }))
        } catch {
            error(t('admin.betting.recalculateError'))
        } finally {
            setRunning(null)
        }
    }

    const recalculateUpcoming = async () => {
        setRunning('upcoming')
        try {
            const result = await apiClient.post<{ matchesUpdated: number }>(
                '/api/admin/odds/recalculate-upcoming', {},
            )
            success(t('admin.betting.recalculateUpcomingSuccess', { count: result.matchesUpdated }))
        } catch {
            error(t('admin.betting.recalculateUpcomingError'))
        } finally {
            setRunning(null)
        }
    }

    const recalculateHistorical = async () => {
        if (!window.confirm(t('admin.betting.recalculateHistoricalConfirm'))) return
        setRunning('historical')
        try {
            const result = await apiClient.post<{ betsUpdated: number }>(
                '/api/admin/bets/recalculate-historical-odds', { targetVersion: Number(targetVersion) },
            )
            success(t('admin.betting.recalculateHistoricalSuccess', { count: result.betsUpdated }))
        } catch {
            error(t('admin.betting.recalculateHistoricalError'))
        } finally {
            setRunning(null)
        }
    }

    return (
        <div className="space-y-4">
            <div className="card p-4 max-w-xl space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-text-muted">
                    {t('admin.betting.recalculateTitle')}
                </h3>
                <p className="text-sm text-text-muted">
                    {t('admin.betting.recalculateDescription')}
                </p>
                <button
                    onClick={() => void recalculateCorrelated()}
                    disabled={busy}
                    className="bg-primary hover:bg-primary-hover px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
                >
                    {running === 'correlated' ? t('common.saving') : t('admin.betting.recalculateButton')}
                </button>
            </div>

            <div className="card p-4 max-w-xl space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-text-muted">
                    {t('admin.betting.recalculateUpcomingTitle')}
                </h3>
                <p className="text-sm text-text-muted">
                    {t('admin.betting.recalculateUpcomingDescription')}
                </p>
                <button
                    onClick={() => void recalculateUpcoming()}
                    disabled={busy}
                    className="bg-primary hover:bg-primary-hover px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
                >
                    {running === 'upcoming' ? t('common.saving') : t('admin.betting.recalculateUpcomingButton')}
                </button>
            </div>

            <div className="card p-4 max-w-xl space-y-3 border border-danger/40">
                <h3 className="text-sm font-bold uppercase tracking-wider text-danger">
                    {t('admin.betting.recalculateHistoricalTitle')}
                </h3>
                <p className="text-sm text-text-muted">
                    {t('admin.betting.recalculateHistoricalDescription')}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                    <label htmlFor="historical-odds-formula-version" className="text-sm text-text-muted">
                        {t('admin.betting.recalculateHistoricalFormulaLabel')}
                    </label>
                    <select
                        id="historical-odds-formula-version"
                        value={targetVersion}
                        onChange={(e) => setTargetVersion(e.target.value)}
                        disabled={busy}
                        className="px-3 py-1.5 rounded border border-border bg-surface text-sm disabled:opacity-50"
                    >
                        <option value={CURRENT_FORMULA_VERSION}>{t('admin.betting.recalculateHistoricalFormulaCurrent')}</option>
                        <option value={LEGACY_FORMULA_VERSION}>{t('admin.betting.recalculateHistoricalFormulaLegacy')}</option>
                    </select>
                </div>
                <button
                    onClick={() => void recalculateHistorical()}
                    disabled={busy}
                    className="btn-danger text-sm"
                >
                    {running === 'historical' ? t('common.saving') : t('admin.betting.recalculateHistoricalButton')}
                </button>
            </div>
        </div>
    )
}
