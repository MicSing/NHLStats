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
    {
        id: 2,
        name: '2024-25',
        hostedTeamId: 2,
        hostedTeamName: 'Edmonton Oilers',
        startedOn: '2024-10-01T00:00:00',
        status: 'Upcoming',
        parentSeasonId: null,
    },
]

const mockSeasonDetail = {
    ...mockSeasons[0],
    users: [mockUsers[0]],
}

const mockMatches = [
    {
        id: 10,
        seasonId: 1,
        matchNumber: 1,
        homeTeamId: 1,
        homeTeamName: 'Boston Bruins',
        awayTeamId: 2,
        awayTeamName: 'Edmonton Oilers',
        homeScore: 3,
        awayScore: 2,
        matchDate: '2023-10-15T00:00:00',
        completionType: 1,
    },
]

const mockUserMatchesForMatch = [
    { id: 1, userId: 1, userName: 'Player One', matchId: 10, seasonId: 1, totalPlus: 2, totalMinus: 1 },
]

const mockAggregatedUserMatches = [
    { id: 2, userId: 1, userName: 'Player One', matchId: null, seasonId: 1, totalPlus: 5, totalMinus: 3 },
]

const mockPoints = [
    { id: 1, userMatchId: 1, pointReasonId: 1, pointReasonName: 'Penalty', isPositive: false, count: 1 },
]

const mockGoals = [
    { id: 1, userMatchId: 1, rosterPlayerId: 1, playerFirstName: 'Connor', playerSurname: 'McDavid', count: 1 },
]

const mockPenalties: object[] = []

const mockSeasonStats = [
    { userId: 1, userName: 'Player One', totalPlus: 5, totalMinus: 3, earnings: 0.75 },
]

const mockTopScorer = {
    rosterPlayerId: 1,
    firstName: 'Connor',
    surname: 'McDavid',
    teamShortName: 'EDM',
    count: 10,
}

const mockTopPenalized = {
    rosterPlayerId: 1,
    firstName: 'Connor',
    surname: 'McDavid',
    teamShortName: 'EDM',
    count: 3,
}

const mockWeekGroups = [
    {
        weekNumber: 1,
        matches: [
            {
                matchId: 10,
                weekNumber: 1,
                matchDate: '2023-10-15T00:00:00',
                homeTeamId: 1,
                homeTeamName: 'Boston Bruins',
                awayTeamId: 2,
                awayTeamName: 'Edmonton Oilers',
                homeScore: 3,
                awayScore: 2,
            },
        ],
    },
]

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

    // ── Matches ──────────────────────────────────────────────────────────────

    rest.get(`${BASE}/api/seasons/:seasonId/matches/:matchId/usermatches`, (req, res, ctx) => {
        if (Number(req.params.matchId) === 10) return res(ctx.json(mockUserMatchesForMatch))
        return res(ctx.json([]))
    }),

    rest.post(`${BASE}/api/seasons/:seasonId/matches/:matchId/usermatches/initialize`, (_req, res, ctx) => {
        return res(ctx.json({ created: 1 }))
    }),

    rest.post(`${BASE}/api/seasons/:seasonId/matches/:matchId/usermatches`, async (req, res, ctx) => {
        const body = await req.json() as { userId: number }
        return res(
            ctx.status(201),
            ctx.json({ id: 99, userId: body.userId, userName: 'Player One', matchId: Number(req.params.matchId), seasonId: Number(req.params.seasonId), totalPlus: 0, totalMinus: 0 }),
        )
    }),

    rest.get(`${BASE}/api/seasons/:seasonId/matches/:id`, (req, res, ctx) => {
        const match = mockMatches.find((m) => m.id === Number(req.params.id))
        return match ? res(ctx.json(match)) : res(ctx.status(404))
    }),

    rest.get(`${BASE}/api/seasons/:seasonId/matches`, (_req, res, ctx) => {
        return res(ctx.json(mockMatches))
    }),

    rest.post(`${BASE}/api/seasons/:seasonId/matches/batch`, async (req, res, ctx) => {
        const body = await req.json() as { homeTeamId: number; awayTeamId: number }[]
        const created = body.map((b, i) => ({
            id: 100 + i,
            seasonId: Number(req.params.seasonId),
            matchNumber: i + 1,
            homeTeamId: b.homeTeamId,
            awayTeamId: b.awayTeamId,
            homeScore: 0,
            awayScore: 0,
            matchDate: null,
            completionType: 0,
            homeTeamName: null,
            awayTeamName: null,
        }))
        return res(ctx.json(created))
    }),

    rest.post(`${BASE}/api/seasons/:seasonId/matches`, async (req, res, ctx) => {
        const body = await req.json() as { homeTeamId: number; awayTeamId: number }
        return res(
            ctx.status(201),
            ctx.json({ id: 99, seasonId: Number(req.params.seasonId), matchNumber: 1, ...body, homeScore: 0, awayScore: 0, matchDate: null, completionType: 0, homeTeamName: null, awayTeamName: null }),
        )
    }),

    rest.put(`${BASE}/api/seasons/:seasonId/matches/:id`, async (req, res, ctx) => {
        const body = await req.json() as { homeTeamId: number; awayTeamId: number; homeScore: number; awayScore: number; matchDate: string | null; completionType: number }
        return res(ctx.json({ id: Number(req.params.id), seasonId: Number(req.params.seasonId), matchNumber: 1, ...body, homeTeamName: null, awayTeamName: null }))
    }),

    rest.delete(`${BASE}/api/seasons/:seasonId/matches/:id`, (_req, res, ctx) => {
        return res(ctx.status(204))
    }),

    // ── Season Stats ──────────────────────────────────────────────────────────
    // NOTE: more-specific paths first so they don't get swallowed by the generic :id handler

    rest.get(`${BASE}/api/seasons/:seasonId/stats/weekly`, (req, res, ctx) => {
        if (Number(req.params.seasonId) === 1) return res(ctx.json(mockWeekGroups))
        return res(ctx.json([]))
    }),

    rest.get(`${BASE}/api/seasons/:seasonId/stats/top-scorers`, (req, res, ctx) => {
        if (Number(req.params.seasonId) === 1) return res(ctx.json(mockTopScorer))
        return res(ctx.status(204))
    }),

    rest.get(`${BASE}/api/seasons/:seasonId/stats/top-penalized`, (req, res, ctx) => {
        if (Number(req.params.seasonId) === 1) return res(ctx.json(mockTopPenalized))
        return res(ctx.status(204))
    }),

    rest.get(`${BASE}/api/seasons/:seasonId/stats`, (req, res, ctx) => {
        if (Number(req.params.seasonId) === 1) return res(ctx.json(mockSeasonStats))
        return res(ctx.json([]))
    }),

    // ── Aggregated UserMatches ────────────────────────────────────────────────

    rest.get(`${BASE}/api/seasons/:seasonId/usermatches`, (req, res, ctx) => {
        if (Number(req.params.seasonId) === 1) return res(ctx.json(mockAggregatedUserMatches))
        return res(ctx.json([]))
    }),

    rest.post(`${BASE}/api/seasons/:seasonId/usermatches`, async (req, res, ctx) => {
        const body = await req.json() as { userId: number }
        return res(
            ctx.status(201),
            ctx.json({ id: 99, userId: body.userId, userName: 'Player One', matchId: null, seasonId: Number(req.params.seasonId), totalPlus: 0, totalMinus: 0 }),
        )
    }),

    // ── UserMatch resource ────────────────────────────────────────────────────

    rest.get(`${BASE}/api/usermatches/:id`, (req, res, ctx) => {
        const um = mockUserMatchesForMatch.find((u) => u.id === Number(req.params.id))
            ?? mockAggregatedUserMatches.find((u) => u.id === Number(req.params.id))
        return um ? res(ctx.json(um)) : res(ctx.status(404))
    }),

    rest.delete(`${BASE}/api/usermatches/:id`, (_req, res, ctx) => {
        return res(ctx.status(204))
    }),

    // ── UserMatch Points ──────────────────────────────────────────────────────

    rest.get(`${BASE}/api/usermatches/:userMatchId/points`, (req, res, ctx) => {
        if (Number(req.params.userMatchId) === 1) return res(ctx.json(mockPoints))
        return res(ctx.json([]))
    }),

    rest.post(`${BASE}/api/usermatches/:userMatchId/points`, async (req, res, ctx) => {
        const body = await req.json() as { pointReasonId: number; count: number }
        return res(
            ctx.status(201),
            ctx.json({ id: 99, userMatchId: Number(req.params.userMatchId), pointReasonId: body.pointReasonId, pointReasonName: 'Penalty', isPositive: false, count: body.count }),
        )
    }),

    rest.put(`${BASE}/api/usermatches/:userMatchId/points/:pointId`, async (req, res, ctx) => {
        const body = await req.json() as { pointReasonId: number; count: number }
        return res(ctx.json({ id: Number(req.params.pointId), userMatchId: Number(req.params.userMatchId), ...body, pointReasonName: 'Penalty', isPositive: false }))
    }),

    rest.delete(`${BASE}/api/usermatches/:userMatchId/points/:pointId`, (_req, res, ctx) => {
        return res(ctx.status(204))
    }),

    // ── UserMatch Goals ───────────────────────────────────────────────────────

    rest.get(`${BASE}/api/usermatches/:userMatchId/goals`, (req, res, ctx) => {
        if (Number(req.params.userMatchId) === 1) return res(ctx.json(mockGoals))
        return res(ctx.json([]))
    }),

    rest.post(`${BASE}/api/usermatches/:userMatchId/goals`, async (req, res, ctx) => {
        const body = await req.json() as { rosterPlayerId: number; count: number }
        return res(
            ctx.status(201),
            ctx.json({ id: 99, userMatchId: Number(req.params.userMatchId), rosterPlayerId: body.rosterPlayerId, playerFirstName: 'Connor', playerSurname: 'McDavid', count: body.count }),
        )
    }),

    rest.put(`${BASE}/api/usermatches/:userMatchId/goals/:goalId`, async (req, res, ctx) => {
        const body = await req.json() as { rosterPlayerId: number; count: number }
        return res(ctx.json({ id: Number(req.params.goalId), userMatchId: Number(req.params.userMatchId), ...body, playerFirstName: 'Connor', playerSurname: 'McDavid' }))
    }),

    rest.delete(`${BASE}/api/usermatches/:userMatchId/goals/:goalId`, (_req, res, ctx) => {
        return res(ctx.status(204))
    }),

    // ── UserMatch Penalties ───────────────────────────────────────────────────

    rest.get(`${BASE}/api/usermatches/:userMatchId/penalties`, (req, res, ctx) => {
        if (Number(req.params.userMatchId) === 1) return res(ctx.json(mockPenalties))
        return res(ctx.json([]))
    }),

    rest.post(`${BASE}/api/usermatches/:userMatchId/penalties`, async (req, res, ctx) => {
        const body = await req.json() as { rosterPlayerId: number; count: number }
        return res(
            ctx.status(201),
            ctx.json({ id: 99, userMatchId: Number(req.params.userMatchId), rosterPlayerId: body.rosterPlayerId, playerFirstName: 'Connor', playerSurname: 'McDavid', count: body.count }),
        )
    }),

    rest.put(`${BASE}/api/usermatches/:userMatchId/penalties/:penaltyId`, async (req, res, ctx) => {
        const body = await req.json() as { rosterPlayerId: number; count: number }
        return res(ctx.json({ id: Number(req.params.penaltyId), userMatchId: Number(req.params.userMatchId), ...body, playerFirstName: 'Connor', playerSurname: 'McDavid' }))
    }),

    rest.delete(`${BASE}/api/usermatches/:userMatchId/penalties/:penaltyId`, (_req, res, ctx) => {
        return res(ctx.status(204))
    }),

    // ── User Season Totals ────────────────────────────────────────────────────

    rest.get(`${BASE}/api/seasons/:seasonId/stats/user-totals`, (req, res, ctx) => {
        if (Number(req.params.seasonId) === 1) {
            return res(ctx.json([
                { userId: 1, userName: 'Player One', totalGoals: 3, totalPenalties: 1 },
            ]))
        }
        return res(ctx.json([]))
    }),

    // ── Payouts ───────────────────────────────────────────────────────────────

    rest.get(`${BASE}/api/seasons/:seasonId/payouts`, (_req, res, ctx) => {
        return res(ctx.json([]))
    }),

    rest.post(`${BASE}/api/seasons/:seasonId/payouts`, async (req, res, ctx) => {
        const body = await req.json() as { userId: number; amount: number; paidOn: string }
        return res(
            ctx.status(201),
            ctx.json({
                id: 99,
                userId: body.userId,
                userName: 'Player One',
                seasonId: Number(req.params.seasonId),
                amount: body.amount,
                paidOn: body.paidOn,
            }),
        )
    }),

    rest.put(`${BASE}/api/seasons/:seasonId/payouts/:id`, async (req, res, ctx) => {
        const body = await req.json() as { amount: number; paidOn: string }
        return res(
            ctx.json({
                id: Number(req.params.id),
                userId: 1,
                userName: 'Player One',
                seasonId: Number(req.params.seasonId),
                amount: body.amount,
                paidOn: body.paidOn,
            }),
        )
    }),

    rest.delete(`${BASE}/api/seasons/:seasonId/payouts/:id`, (_req, res, ctx) => {
        return res(ctx.status(204))
    }),

    // ── Global Stats ──────────────────────────────────────────────────────────

    rest.get(`${BASE}/api/stats/earnings`, (_req, res, ctx) => {
        return res(ctx.json({
            userEarnings: [{ userId: 1, userName: 'Player One', totalPlus: 5, totalMinus: 3, totalEarnings: 0.75 }],
            totalCollected: 0.75,
            totalExpenses: 80.0,
            balance: -79.25,
        }))
    }),
]
