import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import LoadingSpinner from './LoadingSpinner'

// Empty string = relative URLs, so the Vite dev proxy (or same-origin in prod) handles routing —
// same convention as services/apiClient.ts.
const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

const POLL_INTERVAL_MS = 3000
const REQUEST_TIMEOUT_MS = 8000
// After this long without a healthy response, swap to a message that says the wait is expected
// rather than reading as stuck (backend/DB cold starts can legitimately take up to a minute).
const SLOW_MESSAGE_THRESHOLD_MS = 15000

async function checkHealth(): Promise<boolean> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
        const response = await fetch(`${BASE_URL}/health`, { signal: controller.signal })
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
 * database are reachable. Polls on a fixed interval and stops once healthy —
 * this only gates the initial app load, it does not re-check afterwards.
 */
export default function BackendHealthGate({ children }: BackendHealthGateProps) {
    const { t } = useTranslation()
    const [healthy, setHealthy] = useState(false)
    const [slow, setSlow] = useState(false)
    const startedAtRef = useRef<number | null>(null)

    useEffect(() => {
        if (healthy) return

        let cancelled = false
        let timeoutId: ReturnType<typeof setTimeout> | undefined
        startedAtRef.current ??= Date.now()

        const poll = async () => {
            const ok = await checkHealth()
            if (cancelled) return

            if (ok) {
                setHealthy(true)
                return
            }

            if (Date.now() - (startedAtRef.current ?? Date.now()) >= SLOW_MESSAGE_THRESHOLD_MS) {
                setSlow(true)
            }
            timeoutId = setTimeout(() => { void poll() }, POLL_INTERVAL_MS)
        }

        void poll()

        return () => {
            cancelled = true
            if (timeoutId) clearTimeout(timeoutId)
        }
    }, [healthy])

    if (healthy) return <>{children}</>

    return (
        <div className="min-h-screen bg-bg text-text flex items-center justify-center px-4">
            <LoadingSpinner
                size="lg"
                message={slow ? t('common.backendStartingSlow') : t('common.backendStarting')}
            />
        </div>
    )
}
