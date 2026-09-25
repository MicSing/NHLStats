import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiClient from '../../services/apiClient'
import Spinner from '../Spinner'

type ActionKey = 'correlated' | 'upcoming'
type RunningAction = ActionKey | null
type ActionResult = { variant: 'success' | 'error'; message: string } | null

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
    const [results, setResults] = useState<Record<ActionKey, ActionResult>>({
        correlated: null,
        upcoming: null,
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
        </div>
    )
}
