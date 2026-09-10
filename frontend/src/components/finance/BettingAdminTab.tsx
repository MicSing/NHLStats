import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiClient from '../../services/apiClient'

type ActionKey = 'correlated' | 'upcoming' | 'historical'
type RunningAction = ActionKey | null
type ActionResult = { variant: 'success' | 'error'; message: string } | null

const CURRENT_FORMULA_VERSION = '2.0'
const LEGACY_FORMULA_VERSION = '1.0'

function Spinner() {
    return (
        <svg
            className="animate-spin w-4 h-4 shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
        >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
    )
}

function ResultPanel({ result, onDismiss }: { result: ActionResult; onDismiss: () => void }) {
    if (!result) return null
    const variantClasses = result.variant === 'success'
        ? 'border-success/40 bg-success/10 text-success'
        : 'border-danger/40 bg-danger/10 text-danger'

    return (
        <div
            role="status"
            className={`flex items-center gap-3 px-3 py-2 rounded border text-sm ${variantClasses}`}
        >
            <span className="flex-1">{result.message}</span>
            <button
                onClick={onDismiss}
                aria-label="dismiss"
                className="opacity-70 hover:opacity-100 text-lg leading-none"
            >
                ×
            </button>
        </div>
    )
}

export default function BettingAdminTab() {
    const { t } = useTranslation()
    const [running, setRunning] = useState<RunningAction>(null)
    const [elapsedMs, setElapsedMs] = useState(0)
    const [targetVersion, setTargetVersion] = useState(CURRENT_FORMULA_VERSION)
    const [results, setResults] = useState<Record<ActionKey, ActionResult>>({
        correlated: null,
        upcoming: null,
        historical: null,
    })
    const busy = running !== null

    useEffect(() => {
        if (!running) return
        const start = performance.now()
        setElapsedMs(0)
        const id = setInterval(() => setElapsedMs(performance.now() - start), 100)
        return () => clearInterval(id)
    }, [running])

    const runningLabel = () => `${t('admin.betting.recalculating', { seconds: (elapsedMs / 1000).toFixed(1) })}`

    const recalculateCorrelated = async () => {
        setRunning('correlated')
        setResults((r) => ({ ...r, correlated: null }))
        try {
            const result = await apiClient.post<{ betsUpdated: number }>(
                '/api/admin/bets/recalculate-correlated-odds', {},
            )
            setResults((r) => ({ ...r, correlated: { variant: 'success', message: t('admin.betting.recalculateSuccess', { count: result.betsUpdated }) } }))
        } catch {
            setResults((r) => ({ ...r, correlated: { variant: 'error', message: t('admin.betting.recalculateError') } }))
        } finally {
            setRunning(null)
        }
    }

    const recalculateUpcoming = async () => {
        setRunning('upcoming')
        setResults((r) => ({ ...r, upcoming: null }))
        try {
            const result = await apiClient.post<{ matchesUpdated: number }>(
                '/api/admin/odds/recalculate-upcoming', {},
            )
            setResults((r) => ({ ...r, upcoming: { variant: 'success', message: t('admin.betting.recalculateUpcomingSuccess', { count: result.matchesUpdated }) } }))
        } catch {
            setResults((r) => ({ ...r, upcoming: { variant: 'error', message: t('admin.betting.recalculateUpcomingError') } }))
        } finally {
            setRunning(null)
        }
    }

    const recalculateHistorical = async () => {
        if (!window.confirm(t('admin.betting.recalculateHistoricalConfirm'))) return
        setRunning('historical')
        setResults((r) => ({ ...r, historical: null }))
        try {
            const result = await apiClient.post<{ betsUpdated: number }>(
                '/api/admin/bets/recalculate-historical-odds', { targetVersion: Number(targetVersion) },
            )
            setResults((r) => ({ ...r, historical: { variant: 'success', message: t('admin.betting.recalculateHistoricalSuccess', { count: result.betsUpdated }) } }))
        } catch {
            setResults((r) => ({ ...r, historical: { variant: 'error', message: t('admin.betting.recalculateHistoricalError') } }))
        } finally {
            setRunning(null)
        }
    }

    const dismiss = (key: ActionKey) => setResults((r) => ({ ...r, [key]: null }))

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
                    className="flex items-center gap-2 bg-primary hover:bg-primary-hover px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
                >
                    {running === 'correlated' && <Spinner />}
                    {running === 'correlated' ? runningLabel() : t('admin.betting.recalculateButton')}
                </button>
                <ResultPanel result={results.correlated} onDismiss={() => dismiss('correlated')} />
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
                    className="flex items-center gap-2 bg-primary hover:bg-primary-hover px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
                >
                    {running === 'upcoming' && <Spinner />}
                    {running === 'upcoming' ? runningLabel() : t('admin.betting.recalculateUpcomingButton')}
                </button>
                <ResultPanel result={results.upcoming} onDismiss={() => dismiss('upcoming')} />
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
                    className="flex items-center gap-2 btn-danger text-sm"
                >
                    {running === 'historical' && <Spinner />}
                    {running === 'historical' ? runningLabel() : t('admin.betting.recalculateHistoricalButton')}
                </button>
                <ResultPanel result={results.historical} onDismiss={() => dismiss('historical')} />
            </div>
        </div>
    )
}
