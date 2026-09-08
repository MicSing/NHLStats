import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, vi } from 'vitest'
import App from '../App'

describe('smoke', () => {
    beforeEach(() => {
        // App now waits on BackendHealthGate (GET /health) before rendering routes.
        // Only answer /health — leave every other endpoint failing exactly as it did
        // before (no server in this test), so page-level data fetches don't start
        // seeing fabricated 200s in a shape they don't expect.
        vi.stubGlobal('fetch', vi.fn().mockImplementation((input: RequestInfo | URL) => {
            const url = typeof input === 'string' ? input : input.toString()
            if (url.includes('/health')) {
                return Promise.resolve(new Response('{"status":"Healthy"}', { status: 200 }))
            }
            return Promise.reject(new TypeError('Failed to fetch'))
        }))
    })

    test('app renders the login page with a heading', async () => {
        render(<App />)
        await waitFor(() => {
            const heading = screen.queryByRole('heading')
            expect(heading).not.toBeNull()
        })
    })
})
