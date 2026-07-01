import { render, screen, waitFor } from '@testing-library/react'
import { rest } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '../context/ThemeContext'
import { AuthProvider } from '../context/AuthContext'
import TeamStatsPage from '../pages/TeamStatsPage'
import { server } from '../mocks/server'

const BASE = 'http://localhost:5000'

function renderPage() {
    return render(
        <ThemeProvider>
            <AuthProvider>
                <MemoryRouter initialEntries={['/team-stats']}>
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
})
