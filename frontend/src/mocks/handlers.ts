import { rest } from 'msw'

export const handlers = [
    rest.post('http://localhost:5000/api/auth/login', async (req, res, ctx) => {
        const body = await req.json() as { email: string; password: string }
        if (body.email === 'admin@test.com' && body.password === 'Admin123!') {
            return res(ctx.json({ token: 'fake-jwt-token' }))
        }
        return res(ctx.status(401))
    }),

    rest.get('http://localhost:5000/api/auth/me', (_req, res, ctx) => {
        return res(ctx.json({ id: 'user-1', email: 'admin@test.com' }))
    }),
]
