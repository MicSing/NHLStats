import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import apiClient from '../services/apiClient'

function makeJwt(expiresInSeconds: number): string {
    const payload = { exp: Math.floor(Date.now() / 1000) + expiresInSeconds, sub: 'user-1' }
    const encoded = btoa(JSON.stringify(payload))
    return `eyJhbGciOiJIUzI1NiJ9.${encoded}.signature`
}

describe('apiClient silent token refresh', () => {
    beforeEach(() => {
        localStorage.clear()
        vi.resetAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('skips refresh when token has more than 5 minutes remaining', async () => {
        localStorage.setItem('token', makeJwt(600))
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({}), { status: 200 })
        )
        vi.stubGlobal('fetch', fetchMock)

        await apiClient.get('/api/test')

        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(fetchMock.mock.calls[0][0]).not.toContain('/api/auth/refresh')
    })

    it('calls refresh and stores new token when expiry is within 5 minutes', async () => {
        const oldToken = makeJwt(60)
        const newToken = makeJwt(3600)
        localStorage.setItem('token', oldToken)

        const fetchMock = vi.fn()
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ token: newToken }), { status: 200 })
            )
            .mockResolvedValueOnce(
                new Response(JSON.stringify({}), { status: 200 })
            )
        vi.stubGlobal('fetch', fetchMock)

        await apiClient.get('/api/test')

        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(fetchMock.mock.calls[0][0]).toContain('/api/auth/refresh')
        expect(localStorage.getItem('token')).toBe(newToken)
    })

    it('clears localStorage and sets location to /login when refresh fails', async () => {
        localStorage.setItem('token', makeJwt(60))
        localStorage.setItem('user', JSON.stringify({ id: '1' }))

        const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }))
        vi.stubGlobal('fetch', fetchMock)

        Object.defineProperty(window, 'location', { value: { href: '' }, writable: true })

        await expect(apiClient.get('/api/test')).rejects.toThrow('Session expired')

        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(localStorage.getItem('token')).toBeNull()
        expect(localStorage.getItem('user')).toBeNull()
        expect(window.location.href).toBe('/login')
    })

    it('does not clear session on network error during refresh', async () => {
        localStorage.setItem('token', makeJwt(60))

        const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
        vi.stubGlobal('fetch', fetchMock)

        await expect(apiClient.get('/api/test')).rejects.toThrow('Failed to fetch')

        expect(localStorage.getItem('token')).not.toBeNull()
    })
})
