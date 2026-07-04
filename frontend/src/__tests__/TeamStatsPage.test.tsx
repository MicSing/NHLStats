import { render, screen, waitFor } from '@testing-library/react'
import { rest } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '../context/ThemeContext'
import { AuthProvider } from '../context/AuthContext'
import TeamStatsPage from '../pages/TeamStatsPage'
import { server } from '../mocks/server'

const BASE = 'http://localhost:5000'

function renderPage(initialPath = '/team-stats') {
    return render(
        <ThemeProvider>
            <AuthProvider>
                <MemoryRouter initialEntries={[initialPath]}>
                    <Routes>
                        <Route path="/team-stats" element={<TeamStatsPage />} />
                    </Routes>
                </MemoryRouter>
            </AuthProvider>
        </ThemeProvider>,
    )
}

describe('TeamStatsPage', () => {
    test('renders page heading', async () => {
        renderPage()
        expect(await screen.findByRole('heading', { name: /team stats/i })).toBeInTheDocument()
    })

    test('disables hosted team dropdown when only one hosted team exists', async () => {
        renderPage()
        const select = await screen.findByRole('combobox', { name: /select your team/i })
        expect(select).toBeDisabled()
    })

    test('enables hosted team dropdown when multiple hosted teams exist', async () => {
        server.use(
            rest.get(`${BASE}/api/team-stats/hosted-teams`, (_req, res, ctx) => {
                return res(ctx.json([
                    { id: 1, name: 'Boston Bruins', shortName: 'BOS' },
                    { id: 3, name: 'Toronto Maple Leafs', shortName: 'TOR' },
                ]))
            }),
        )
        renderPage()
        const select = await screen.findByRole('combobox', { name: /select your team/i })
        expect(select).not.toBeDisabled()
    })

    test('shows summary stats and handles null leaders as dash', async () => {
        renderPage()
        expect((await screen.findAllByText('Player One')).length).toBeGreaterThan(0)
        expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    })

    test('shows paired name for scoring leaders', async () => {
        renderPage()
        expect((await screen.findAllByText(/John Scorer/)).length).toBeGreaterThan(0)
    })

    test('lists all contributing users when a player scored with multiple users', async () => {
        renderPage()
        expect(await screen.findByText(/Player One \(3\), Player Two \(2\)/)).toBeInTheDocument()
    })

    test('shows matches list', async () => {
        renderPage()
        await waitFor(() => {
            expect(screen.getByText(/3 – 2/)).toBeInTheDocument()
        })
    })

    test('preselects opponent from URL query params instead of alphabetical default', async () => {
        server.use(
            rest.get(`${BASE}/api/team-stats/opponents`, (_req, res, ctx) => {
                return res(ctx.json([
                    { id: 2, name: 'Edmonton Oilers', shortName: 'EDM' },
                    { id: 4, name: 'Anaheim Ducks', shortName: 'ANA' },
                ]))
            }),
        )
        renderPage('/team-stats?hostedTeamId=1&opponentTeamId=2')
        const select = await screen.findByRole('combobox', { name: /select opponent/i }) as HTMLSelectElement
        await waitFor(() => {
            expect(select.value).toBe('2')
        })
    })

    test('falls back to alphabetical default when URL opponentTeamId does not exist for hosted team', async () => {
        server.use(
            rest.get(`${BASE}/api/team-stats/opponents`, (_req, res, ctx) => {
                return res(ctx.json([
                    { id: 2, name: 'Edmonton Oilers', shortName: 'EDM' },
                    { id: 4, name: 'Anaheim Ducks', shortName: 'ANA' },
                ]))
            }),
        )
        renderPage('/team-stats?hostedTeamId=1&opponentTeamId=999')
        const select = await screen.findByRole('combobox', { name: /select opponent/i }) as HTMLSelectElement
        await waitFor(() => {
            expect(select.value).toBe('4')
        })
    })

    test('renders goal differential chart with correct W-L-OTL record', async () => {
        server.use(
            rest.get(`${BASE}/api/team-stats/matches`, (_req, res, ctx) => {
                return res(ctx.json([
                    { matchId: 1, seasonId: 1, seasonName: '2023-24', matchDate: '2023-10-15T00:00:00', isHome: true, homeScore: 3, awayScore: 2, completionType: 'RegularTime' },
                    { matchId: 2, seasonId: 1, seasonName: '2023-24', matchDate: '2023-11-01T00:00:00', isHome: false, homeScore: 4, awayScore: 1, completionType: 'RegularTime' },
                    { matchId: 3, seasonId: 1, seasonName: '2023-24', matchDate: '2023-12-01T00:00:00', isHome: true, homeScore: 2, awayScore: 3, completionType: 'Overtime' },
                ]))
            }),
        )
        renderPage()
        expect(await screen.findByRole('img', { name: /goals for vs against/i })).toBeInTheDocument()
        expect(await screen.findByText('1W')).toBeInTheDocument()
        expect(screen.getByText('1L')).toBeInTheDocument()
        expect(screen.getByText('1OTL')).toBeInTheDocument()
    })

    test('does not render goal differential chart when there are no matches', async () => {
        server.use(
            rest.get(`${BASE}/api/team-stats/matches`, (_req, res, ctx) => res(ctx.json([]))),
        )
        renderPage()
        await screen.findByRole('heading', { name: /team stats/i })
        expect(screen.queryByRole('img', { name: /goals for vs against/i })).not.toBeInTheDocument()
    })
})
