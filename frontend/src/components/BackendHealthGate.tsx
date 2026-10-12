import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import LoadingSpinner from './LoadingSpinner'
import { averageWakeMs, recordWakeDuration } from '../utils/wakeStats'

// Empty string = relative URLs, so the Vite dev proxy (or same-origin in prod) handles routing —
// same convention as services/apiClient.ts.
const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

// The backend holds /health?wait=N open and retries the DB itself, answering the moment
// it is reachable — so one long request replaces client-side polling.
const HEALTH_WAIT_SECONDS = 50
const REQUEST_TIMEOUT_MS = (HEALTH_WAIT_SECONDS + 10) * 1000
// Pause before re-asking after a failed request (e.g. a 502 while App Service itself starts).
const RETRY_DELAY_MS = 2000
// Only loads slower than this count as a real wake-up worth remembering.
const MIN_RECORDED_WAKE_MS = 3000
// Without any wake-up history, swap to a "this is expected" message after this long.
const SLOW_MESSAGE_THRESHOLD_MS = 15000

async function checkHealth(): Promise<boolean> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
        const response = await fetch(`${BASE_URL}/health?wait=${HEALTH_WAIT_SECONDS}`, { signal: controller.signal })
        return response.ok
    } catch {
        return false
    } finally {
        clearTimeout(timeoutId)
    }
}

interface BackendHealthGateProps {
    children: ReactNode
}

/**
 * Blocks rendering of `children` until GET /health reports the backend AND its
 * database are reachable. Shows the elapsed time and, once this browser has seen
 * a wake-up before, how long one usually takes. Only gates the initial app load.
 */
export default function BackendHealthGate({ children }: BackendHealthGateProps) {
    const { t } = useTranslation()
    const [healthy, setHealthy] = useState(false)
    const [elapsedMs, setElapsedMs] = useState(0)
    const startedAtRef = useRef<number | null>(null)
    const [typicalMs] = useState(() => averageWakeMs())

    useEffect(() => {
        if (healthy) return

        let cancelled = false
        let retryId: ReturnType<typeof setTimeout> | undefined
        startedAtRef.current ??= Date.now()
        const startedAt = startedAtRef.current

        const tickId = setInterval(() => setElapsedMs(Date.now() - startedAt), 1000)

        const attempt = async () => {
            const ok = await checkHealth()
            if (cancelled) return

            if (ok) {
                const took = Date.now() - startedAt
                if (took > MIN_RECORDED_WAKE_MS) recordWakeDuration(took)
                setHealthy(true)
                return
            }
            retryId = setTimeout(() => { void attempt() }, RETRY_DELAY_MS)
        }

        void attempt()

        return () => {
            cancelled = true
            clearInterval(tickId)
            if (retryId) clearTimeout(retryId)
        }
    }, [healthy])

    if (healthy) return <>{children}</>

    const elapsedSeconds = Math.floor(elapsedMs / 1000)
    const slow = typicalMs != null ? elapsedMs > typicalMs : elapsedMs >= SLOW_MESSAGE_THRESHOLD_MS
    const message = !slow
        ? t('common.backendStarting')
        : typicalMs != null ? t('common.backendSlowerThanUsual') : t('common.backendStartingSlow')
    const progress = typicalMs != null ? Math.min(95, (elapsedMs / typicalMs) * 100) : null

    return (
        <div className="min-h-screen bg-bg text-text flex flex-col items-center justify-center px-4">
            <LoadingSpinner size="lg" message={message} />
            <div className="flex flex-col items-center gap-2 text-sm text-text-muted w-64 max-w-full">
                <p>{t('common.backendElapsed', { seconds: elapsedSeconds })}</p>
                {typicalMs != null && progress != null && (
                    <>
                        <p>{t('common.backendTypical', { seconds: Math.round(typicalMs / 1000) })}</p>
                        <div
                            className="w-full h-1.5 rounded-full bg-border overflow-hidden"
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(progress)}
                        >
                            <div
                                className="h-full bg-primary transition-[width] duration-1000 ease-linear"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
