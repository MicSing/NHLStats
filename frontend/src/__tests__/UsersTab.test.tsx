import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { rest } from 'msw'
import { vi } from 'vitest'
import { renderWithProviders } from './testUtils'
import UsersTab from '../components/season/UsersTab'
import { server } from '../mocks/server'
import type { Season, SeasonDetail } from '../types/season'

const BASE = 'http://localhost:5000'

const season: Season = {
    id: 1,
    name: '2023-24',
    hostedTeamId: null,
    hostedTeamName: null,
    startedOn: '2023-10-01T00:00:00',
    status: 'Active',
    parentSeasonId: null,
    leagueType: 'NHL',
    nhlYear: null,
    console: null,
}

const seasonDetail: SeasonDetail = {
    ...season,
    users: [
        { id: 1, name: 'Player One', isActive: true, position: null, isActiveInSeason: true },
        { id: 2, name: 'Player Two', isActive: true, position: null, isActiveInSeason: false },
    ],
}

describe('UsersTab season activation', () => {
    test('reflects season activation state per user', () => {
        renderWithProviders(
            <UsersTab season={season} allUsers={[]} seasonDetail={seasonDetail} onRefreshDetail={() => {}} />,
        )
        expect(screen.getByRole('checkbox', { name: /player one/i })).toBeChecked()
        expect(screen.getByRole('checkbox', { name: /player two/i })).not.toBeChecked()
    })

    test('toggling a user sends the new season activation state', async () => {
        let body: unknown = null
        server.use(
            rest.put(`${BASE}/api/seasons/1/users/1/active`, async (req, res, ctx) => {
                body = await req.json()
                return res(ctx.json(seasonDetail))
            }),
        )
        const onRefresh = vi.fn()
        renderWithProviders(
            <UsersTab season={season} allUsers={[]} seasonDetail={seasonDetail} onRefreshDetail={onRefresh} />,
        )

        await userEvent.click(screen.getByRole('checkbox', { name: /player one/i }))

        await waitFor(() => expect(onRefresh).toHaveBeenCalled())
        expect(body).toEqual({ isActive: false })
    })
})
