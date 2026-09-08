import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import BackendHealthGate from '../components/BackendHealthGate'

// Advances fake timers and lets any already-resolved promises (e.g. a mocked
// fetch) settle and flow through React state updates, wrapped in act().
async function flush(ms = 0) {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(ms)
    })
}

describe('BackendHealthGate', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    it('does not render children until /health succeeds, then renders them', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(null, { status: 503 }))
            .mockResolvedValueOnce(new Response(null, { status: 503 }))
            .mockResolvedValueOnce(new Response('{"status":"Healthy"}', { status: 200 }))
        vi.stubGlobal('fetch', fetchMock)

        render(
            <BackendHealthGate>
                <div>App content</div>
            </BackendHealthGate>,
        )

        // First attempt fires immediately on mount, before children render.
        await flush()
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(fetchMock.mock.calls[0][0]).toContain('/health')
        expect(screen.queryByText('App content')).not.toBeInTheDocument()

        await flush(3000)
        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(screen.queryByText('App content')).not.toBeInTheDocument()

        await flush(3000)
        expect(fetchMock).toHaveBeenCalledTimes(3)
        expect(screen.getByText('App content')).toBeInTheDocument()
    })

    it('stops polling once healthy', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response('{"status":"Healthy"}', { status: 200 }))
        vi.stubGlobal('fetch', fetchMock)

        render(
            <BackendHealthGate>
                <div>App content</div>
            </BackendHealthGate>,
        )

        await flush()
        expect(screen.getByText('App content')).toBeInTheDocument()
        expect(fetchMock).toHaveBeenCalledTimes(1)

        await flush(10000)
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('shows a slower reassurance message after repeated failures', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 503 }))
        vi.stubGlobal('fetch', fetchMock)

        render(
            <BackendHealthGate>
                <div>App content</div>
            </BackendHealthGate>,
        )

        await flush()
        expect(screen.getByRole('status')).toHaveTextContent('Waking up the server')

        await flush(18000)
        expect(screen.getByRole('status')).toHaveTextContent('Still waking up')
    })
})
