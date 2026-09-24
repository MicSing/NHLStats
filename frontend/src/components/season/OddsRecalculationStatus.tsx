import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiClient from '../../services/apiClient'
import type { OddsRecalculationStatus as Status } from '../../types/match'
import Spinner from '../Spinner'

const POLL_INTERVAL_MS = 2000

type View =
    | { kind: 'hidden' }
    | { kind: 'running'; done: number; total: number }
    | { kind: 'ready' }
    | { kind: 'failed'; count: number; error: string }

interface Props {
    seasonId: number
    /** Bump to re-check (and start polling) after new matches were generated. */
    refreshKey?: number
    /** Receives the ids of matches whose odds are still being calculated. */
    onPendingChange?: (matchIds: number[]) => void
}

/**
 * Admin-only banner showing the background betting-odds calculation for newly generated
 * matches (see GET /api/admin/seasons/{id}/odds-status). Polls while the calculation runs.
 */
export default function OddsRecalculationStatus({ seasonId, refreshKey = 0, onPendingChange }: Props) {
    const { t } = useTranslation()
    const [view, setView] = useState<View>({ kind: 'hidden' })
    const [elapsedMs, setElapsedMs] = useState(0)
    const [retrying, setRetrying] = useState(false)
    const onPendingChangeRef = useRef(onPendingChange)
    onPendingChangeRef.current = onPendingChange

    useEffect(() => {
        let cancelled = false
        let timer: ReturnType<typeof setTimeout> | undefined
        let sawRunning = false

        const poll = async () => {
            let status: Status
            try {
                status = await apiClient.get<Status>(`/api/admin/seasons/${seasonId}/odds-status`)
            } catch {
                return
            }
            if (cancelled) return

            onPendingChangeRef.current?.(status.pendingMatchIds)
            if (status.inProgress) {
                sawRunning = true
                setView({ kind: 'running', done: status.completed + status.failed, total: status.completed + status.failed + status.pending })
                timer = setTimeout(() => void poll(), POLL_INTERVAL_MS)
            } else if (status.failed > 0) {
                setView({ kind: 'failed', count: status.failed, error: status.lastError ?? '' })
            } else {
                setView(sawRunning ? { kind: 'ready' } : { kind: 'hidden' })
            }
        }

        void poll()
        return () => {
            cancelled = true
            if (timer) clearTimeout(timer)
        }
    }, [seasonId, refreshKey])

    const running = view.kind === 'running'
    useEffect(() => {
        if (!running) return
        const start = Date.now()
        setElapsedMs(0)
        const id = setInterval(() => setElapsedMs(Date.now() - start), 100)
        return () => clearInterval(id)
    }, [running])

    const retry = async () => {
        setRetrying(true)
        try {
            await apiClient.post('/api/admin/odds/recalculate-upcoming', {})
            setView({ kind: 'ready' })
        } catch {
            // keep showing the failure so the admin can try again
        } finally {
            setRetrying(false)
        }
    }

    if (view.kind === 'hidden') return null

    if (view.kind === 'failed') {
        return (
            <div role="alert" className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-lg border border-danger/40 bg-danger/10 text-danger text-sm">
                <span className="flex-1 min-w-0">
                    {t('season.oddsFailed', { count: view.count, error: view.error })}
                </span>
                <button
                    type="button"
                    onClick={() => void retry()}
                    disabled={retrying}
                    className="flex items-center gap-2 bg-danger/20 hover:bg-danger/30 px-3 py-1 rounded font-medium disabled:opacity-50"
                >
                    {retrying && <Spinner />}
                    {t('season.oddsRetry')}
                </button>
            </div>
        )
    }

    if (view.kind === 'ready') {
        return (
            <div role="status" className="flex items-center gap-3 px-4 py-3 rounded-lg border border-success/40 bg-success/10 text-success text-sm">
                <span className="flex-1">{t('season.oddsReady')}</span>
                <button
                    type="button"
                    onClick={() => setView({ kind: 'hidden' })}
                    aria-label={t('common.close')}
                    className="opacity-70 hover:opacity-100 text-lg leading-none"
                >
                    ×
                </button>
            </div>
        )
    }

    return (
        <div role="status" className="flex items-center gap-3 px-4 py-3 rounded-lg border border-primary/40 bg-primary/10 text-primary text-sm">
            <Spinner />
            <span>
                {t('season.oddsCalculating', {
                    done: view.done,
                    total: view.total,
                    seconds: (elapsedMs / 1000).toFixed(1),
                })}
            </span>
        </div>
    )
}
