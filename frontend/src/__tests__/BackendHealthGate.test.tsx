import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import BackendHealthGate from '../components/BackendHealthGate'

const STORAGE_KEY = 'nhlstats.wakeDurations'

// Advances fake timers and lets any already-resolved promises (e.g. a mocked
// fetch) settle and flow through React state updates, wrapped in act().
async function flush(ms = 0) {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(ms)
    })
}

// A fetch that stays pending until resolved by hand — stands in for the backend
// holding /health?wait=N open while the DB wakes up.
function deferredResponse() {
    let resolve!: (r: Response) => void
    const promise = new Promise<Response>((r) => { resolve = r })
    return { promise, resolve }
}

function renderGate() {
    return render(
        <BackendHealthGate>
            <div>App content</div>
        </BackendHealthGate>,
    )
}

describe('BackendHealthGate', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        localStorage.clear()
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    it('asks the backend to wait and renders children as soon as it answers healthy', async () => {
        const pending = deferredResponse()
        const fetchMock = vi.fn().mockReturnValueOnce(pending.promise)
        vi.stubGlobal('fetch', fetchMock)

        renderGate()
        await flush()
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(fetchMock.mock.calls[0][0]).toContain('/health?wait=')
        expect(screen.queryByText('App content')).not.toBeInTheDocument()

        // One long-held request — no client-side polling meanwhile.
        await flush(20000)
        expect(fetchMock).toHaveBeenCalledTimes(1)

        pending.resolve(new Response('{"status":"Healthy"}', { status: 200 }))
        await flush()
        expect(screen.getByText('App content')).toBeInTheDocument()
    })

    it('retries after a short pause when the request fails', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(null, { status: 503 }))
            .mockResolvedValueOnce(new Response('{"status":"Healthy"}', { status: 200 }))
        vi.stubGlobal('fetch', fetchMock)

        renderGate()
        await flush()
        expect(fetchMock).toHaveBeenCalledTimes(1)

        await flush(1999)
        expect(fetchMock).toHaveBeenCalledTimes(1)

        await flush(1)
        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(screen.getByText('App content')).toBeInTheDocument()
    })

    it('records a real wake-up duration but not a fast load', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })))
        renderGate()
        await flush()
        expect(screen.getByText('App content')).toBeInTheDocument()
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })

    it('stores how long a slow wake-up took', async () => {
        const pending = deferredResponse()
        vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(pending.promise))

        renderGate()
        await flush(30000)
        pending.resolve(new Response('{}', { status: 200 }))
        await flush()

        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as number[]
        expect(stored).toHaveLength(1)
        expect(stored[0]).toBeGreaterThanOrEqual(30000)
    })

    it('shows elapsed time and the usual wake-up time from history', async () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([40000, 50000]))
        vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))

        renderGate()
        await flush(12000)
        expect(screen.getByText('Elapsed 12 s')).toBeInTheDocument()
        expect(screen.getByText('Usually takes ~45 s')).toBeInTheDocument()
        expect(screen.getByRole('progressbar')).toBeInTheDocument()
        expect(screen.getByRole('status')).toHaveTextContent('Waking up the server')

        await flush(34000)
        expect(screen.getByRole('status')).toHaveTextContent('Taking longer than usual')
    })

    it('without history shows the reassurance message after a while', async () => {
        vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))

        renderGate()
        await flush()
        expect(screen.getByRole('status')).toHaveTextContent('Waking up the server')
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()

        await flush(16000)
        expect(screen.getByRole('status')).toHaveTextContent('Still waking up')
    })
})
