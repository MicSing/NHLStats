import { rest } from 'msw'
import { server } from '../../mocks/server'
import apiClient from '../../services/apiClient'

describe('apiClient', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    test('includes Authorization header when token exists in localStorage', async () => {
        localStorage.setItem('token', 'test-token-123')

        let capturedAuthHeader: string | null = null
        server.use(
            rest.get('http://localhost:5000/api/test', (req, res, ctx) => {
                capturedAuthHeader = req.headers.get('Authorization')
                return res(ctx.json({ ok: true }))
            }),
        )

        await apiClient.get('/api/test')
        expect(capturedAuthHeader).toBe('Bearer test-token-123')
    })

    test('does not include Authorization header when no token', async () => {
        let capturedAuthHeader: string | null = null
        server.use(
            rest.get('http://localhost:5000/api/test-noauth', (req, res, ctx) => {
                capturedAuthHeader = req.headers.get('Authorization')
                return res(ctx.json({ ok: true }))
            }),
        )

        await apiClient.get('/api/test-noauth')
        expect(capturedAuthHeader).toBeNull()
    })

    test('throws on non-ok response', async () => {
        server.use(
            rest.get('http://localhost:5000/api/test-error', (_req, res, ctx) => {
                return res(ctx.status(404))
            }),
        )

        await expect(apiClient.get('/api/test-error')).rejects.toThrow('HTTP error 404')
    })
})
