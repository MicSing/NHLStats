import { rest } from 'msw'

const BASE = 'http://localhost:5000'

// --------------- Fixture data ---------------

const mockUsers = [
    { id: 1, name: 'Player One', isActive: true },
    { id: 2, name: 'Player Two', isActive: false },
]

const mockTeams = [
    { id: 1, name: 'Boston Bruins', shortName: 'BOS' },
    { id: 2, name: 'Edmonton Oilers', shortName: 'EDM' },
]

const mockSeasons = [
    {
        id: 1,
        name: '2023-24',
        hostedTeamId: 1,
        hostedTeamName: 'Boston Bruins',
        startedOn: '2023-10-01T00:00:00',
        status: 'Active',
        parentSeasonId: null,
    },
]

const mockSeasonDetail = {
    ...mockSeasons[0],
    users: [mockUsers[0]],
}

const mockRosterPlayers = [
    {
        id: 1,
        firstName: 'Connor',
        surname: 'McDavid',
        position: 'C',
        teamId: 2,
        teamName: 'Edmonton Oilers',
        teamShortName: 'EDM',
        seasonId: 1,
        isActive: true,
    },
]

const mockPointReasons = [
    { id: 1, name: 'Penalty', isPositive: false, isActive: true },
    { id: 2, name: 'Scoring 10 Goals', isPositive: true, isActive: true },
]

const mockMoneyConfigCurrent = {
    id: 1,
    negativePointValue: 0.5,
    positivePointValue: 0.25,
    effectiveFrom: '2023-01-01T00:00:00',
}

const mockMoneyConfigHistory = [
    mockMoneyConfigCurrent,
    {
        id: 2,
        negativePointValue: 0.4,
        positivePointValue: 0.2,
        effectiveFrom: '2022-01-01T00:00:00',
    },
]

const mockExpenses = [
    { id: 1, description: 'Pizza party', amount: 50.0, date: '2023-10-05T00:00:00' },
    { id: 2, description: 'Trophy', amount: 30.0, date: '2023-10-10T00:00:00' },
]

// --------------- Handlers ---------------

export const handlers = [
    // Auth
    rest.post(`${BASE}/api/auth/login`, async (req, res, ctx) => {
        const body = await req.json() as { email: string; password: string }
        if (body.email === 'admin@test.com' && body.password === 'Admin123!') {
            return res(ctx.json({ token: 'fake-jwt-token' }))
        }
        return res(ctx.status(401))
    }),

    rest.get(`${BASE}/api/auth/me`, (_req, res, ctx) => {
        return res(ctx.json({ id: 'user-1', email: 'admin@test.com' }))
    }),

    // Users
    rest.get(`${BASE}/api/users`, (_req, res, ctx) => {
        return res(ctx.json(mockUsers))
    }),

    rest.get(`${BASE}/api/users/:id`, (req, res, ctx) => {
        const user = mockUsers.find((u) => u.id === Number(req.params.id))
        return user ? res(ctx.json(user)) : res(ctx.status(404))
    }),

    rest.post(`${BASE}/api/users`, async (req, res, ctx) => {
        const body = await req.json() as { name: string }
        return res(ctx.status(201), ctx.json({ id: 99, name: body.name, isActive: true }))
    }),

    rest.put(`${BASE}/api/users/:id`, async (req, res, ctx) => {
        const body = await req.json() as { name: string; isActive: boolean }
        return res(ctx.json({ id: Number(req.params.id), name: body.name, isActive: body.isActive }))
    }),

    rest.delete(`${BASE}/api/users/:id`, (_req, res, ctx) => {
        return res(ctx.status(204))
    }),

    // Teams
    rest.get(`${BASE}/api/teams`, (_req, res, ctx) => {
        return res(ctx.json(mockTeams))
    }),

    // Seasons
    rest.get(`${BASE}/api/seasons`, (_req, res, ctx) => {
        return res(ctx.json(mockSeasons))
    }),

    rest.get(`${BASE}/api/seasons/:id`, (req, res, ctx) => {
        if (Number(req.params.id) === 1) return res(ctx.json(mockSeasonDetail))
        return res(ctx.status(404))
    }),

    rest.post(`${BASE}/api/seasons`, async (req, res, ctx) => {
        const body = await req.json() as { name: string; startedOn: string }
        return res(
            ctx.status(201),
            ctx.json({
                id: 99,
                name: body.name,
                hostedTeamId: null,
                hostedTeamName: null,
                startedOn: body.startedOn,
                status: null,
                parentSeasonId: null,
            }),
        )
    }),

    rest.put(`${BASE}/api/seasons/:id`, async (req, res, ctx) => {
        const body = await req.json() as { name: string; startedOn: string }
        return res(
            ctx.json({
                id: Number(req.params.id),
                name: body.name,
                hostedTeamId: null,
                hostedTeamName: null,
                startedOn: body.startedOn,
                status: null,
                parentSeasonId: null,
            }),
        )
    }),

    rest.delete(`${BASE}/api/seasons/:id`, (_req, res, ctx) => {
        return res(ctx.status(204))
    }),

    rest.post(`${BASE}/api/seasons/:id/users/:userId`, (req, res, ctx) => {
        return res(ctx.json({ ...mockSeasonDetail, id: Number(req.params.id) }))
    }),

    rest.delete(`${BASE}/api/seasons/:id/users/:userId`, (_req, res, ctx) => {
        return res(ctx.status(204))
    }),

    // Roster
    rest.get(`${BASE}/api/seasons/:seasonId/roster`, (req, res, ctx) => {
        if (Number(req.params.seasonId) === 1) return res(ctx.json(mockRosterPlayers))
        return res(ctx.json([]))
    }),

    rest.post(`${BASE}/api/seasons/:seasonId/roster`, async (req, res, ctx) => {
        const body = await req.json() as { firstName: string; surname: string }
        return res(
            ctx.status(201),
            ctx.json({
                id: 99,
                firstName: body.firstName,
                surname: body.surname,
                position: null,
                teamId: 1,
                teamName: 'Boston Bruins',
                teamShortName: 'BOS',
                seasonId: Number(req.params.seasonId),
                isActive: true,
            }),
        )
    }),

    rest.put(`${BASE}/api/seasons/:seasonId/roster/:id`, async (req, res, ctx) => {
        const body = await req.json() as { firstName: string; surname: string; isActive: boolean }
        return res(
            ctx.json({
                id: Number(req.params.id),
                firstName: body.firstName,
                surname: body.surname,
                position: null,
                teamId: 1,
                teamName: 'Boston Bruins',
                teamShortName: 'BOS',
                seasonId: Number(req.params.seasonId),
                isActive: body.isActive,
            }),
        )
    }),

    rest.delete(`${BASE}/api/seasons/:seasonId/roster/:id`, (_req, res, ctx) => {
        return res(ctx.status(204))
    }),

    rest.post(`${BASE}/api/seasons/:seasonId/roster/import`, async (_req, res, ctx) => {
        return res(ctx.json({ imported: 2, errors: [] }))
    }),

    rest.post(`${BASE}/api/seasons/:seasonId/roster/copy/:sourceSeasonId`, (_req, res, ctx) => {
        return res(ctx.json(mockRosterPlayers))
    }),

    // Point Reasons
    rest.get(`${BASE}/api/pointreasons`, (_req, res, ctx) => {
        return res(ctx.json(mockPointReasons))
    }),

    rest.post(`${BASE}/api/pointreasons`, async (req, res, ctx) => {
        const body = await req.json() as { name: string; isPositive: boolean }
        return res(ctx.status(201), ctx.json({ id: 99, name: body.name, isPositive: body.isPositive, isActive: true }))
    }),

    rest.put(`${BASE}/api/pointreasons/:id`, async (req, res, ctx) => {
        const body = await req.json() as { name: string; isPositive: boolean; isActive: boolean }
        return res(ctx.json({ id: Number(req.params.id), ...body }))
    }),

    rest.delete(`${BASE}/api/pointreasons/:id`, (_req, res, ctx) => {
        return res(ctx.status(204))
    }),

    // Money Config
    rest.get(`${BASE}/api/moneyconfig/current`, (_req, res, ctx) => {
        return res(ctx.json(mockMoneyConfigCurrent))
    }),

    rest.get(`${BASE}/api/moneyconfig/history`, (_req, res, ctx) => {
        return res(ctx.json(mockMoneyConfigHistory))
    }),

    rest.post(`${BASE}/api/moneyconfig`, async (req, res, ctx) => {
        const body = await req.json() as { negativePointValue: number; positivePointValue: number; effectiveFrom: string }
        return res(ctx.status(201), ctx.json({ id: 99, ...body }))
    }),

    // Expenses
    rest.get(`${BASE}/api/expenses`, (_req, res, ctx) => {
        return res(ctx.json(mockExpenses))
    }),

    rest.post(`${BASE}/api/expenses`, async (req, res, ctx) => {
        const body = await req.json() as { description?: string; amount: number; date: string }
        return res(ctx.status(201), ctx.json({ id: 99, description: body.description ?? null, amount: body.amount, date: body.date }))
    }),

    rest.put(`${BASE}/api/expenses/:id`, async (req, res, ctx) => {
        const body = await req.json() as { description?: string; amount: number; date: string }
        return res(ctx.json({ id: Number(req.params.id), description: body.description ?? null, amount: body.amount, date: body.date }))
    }),

    rest.delete(`${BASE}/api/expenses/:id`, (_req, res, ctx) => {
        return res(ctx.status(204))
    }),
]
