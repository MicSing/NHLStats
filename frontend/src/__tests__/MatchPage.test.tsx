import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext'
import { ToastProvider } from '../context/ToastContext'
import apiClient from '../services/apiClient'
import MatchPage from '../pages/MatchPage'
import { rest } from 'msw'
import { server } from '../mocks/server'

const BASE = 'http://localhost:5000'

function useSeasonWithoutPoints() {
    server.use(
        rest.get(`${BASE}/api/seasons/1`, (_req, res, ctx) =>
            res(
                ctx.json({
                    id: 1,
                    name: '2023-24',
                    hostedTeamId: 1,
                    hostedTeamName: 'Boston Bruins',
                    startedOn: '2023-10-01T00:00:00',
                    status: 'Active',
                    parentSeasonId: null,
                    leagueType: 'NHL',
                    pointsEnabled: false,
                    users: [],
                }),
            ),
        ),
    )
}

function renderMatchPage({ authenticated = true } = {}) {
    if (authenticated) {
        localStorage.setItem('token', 'fake-jwt-token')
        localStorage.setItem('user', JSON.stringify({ id: '1', email: 'admin@test.com' }))
    } else {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
    }
    return render(
        <ToastProvider>
            <AuthProvider>
                <MemoryRouter initialEntries={['/seasons/1/matches/10']}>
                    <Routes>
                        <Route
                            path="/seasons/:seasonId/matches/:matchId"
                            element={<MatchPage />}
                        />
                        <Route path="/seasons/:seasonId" element={<div>Season Page</div>} />
                    </Routes>
                </MemoryRouter>
            </AuthProvider>
        </ToastProvider>,
    )
}

describe('MatchPage', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    test('renders match header with teams and score', async () => {
        renderMatchPage()
        // Team names are always shown in the header
        expect(await screen.findByText('Boston Bruins')).toBeInTheDocument()
        expect(screen.getByText('Edmonton Oilers')).toBeInTheDocument()
        // Score is displayed directly
        expect(screen.getByText('3')).toBeInTheDocument()
        expect(screen.getAllByText('2').length).toBeGreaterThan(0)
    })

    test('renders all user entries for match', async () => {
        renderMatchPage()
        // UserMatch for "Player One"
        expect(await screen.findByText('Player One')).toBeInTheDocument()
        // totals: +2 / −1
        expect(screen.getByText('+2')).toBeInTheDocument()
        expect(screen.getByText('−1')).toBeInTheDocument()
    })

    test('shows existing goal entry in the flat entries row', async () => {
        renderMatchPage()
        // mockGoals: Connor McDavid × 1 (always visible, no tab needed)
        expect(await screen.findByText(/connor mcdavid/i)).toBeInTheDocument()
    })

    test('shows existing point entries in the flat entries row', async () => {
        renderMatchPage()
        // mockPoints: Penalty × 1 and Scoring 10 Goals × 2 (always visible, no tab needed)
        expect(await screen.findByText(/scoring 10 goals/i)).toBeInTheDocument()
        expect(screen.getAllByText(/penalty/i).length).toBeGreaterThan(0)
    })

    test('goal quick-action button is visible when authenticated', async () => {
        renderMatchPage()
        expect(await screen.findByText('Player One')).toBeInTheDocument()
        expect(screen.getAllByRole('button', { name: /^goal$/i }).length).toBeGreaterThan(0)
    })

    test('penalty quick-action button is visible when authenticated', async () => {
        renderMatchPage()
        expect(await screen.findByText('Player One')).toBeInTheDocument()
        expect(screen.getAllByRole('button', { name: /^penalty$/i }).length).toBeGreaterThan(0)
    })

    test('Negative, Positive, and Neutral point rows shown when authenticated', async () => {
        renderMatchPage()
        expect(await screen.findByText('Player One')).toBeInTheDocument()
        expect(screen.getByText('Negative')).toBeInTheDocument()
        expect(screen.getByText('Positive')).toBeInTheDocument()
        expect(screen.getByText('Neutral')).toBeInTheDocument()
        // Reason chip button, e.g. "Penalty" under the Negative row
        expect(screen.getAllByRole('button', { name: /^penalty$/i }).length).toBeGreaterThan(0)
    })

    test('edit controls hidden when not authenticated', async () => {
        renderMatchPage({ authenticated: false })
        // Wait for page to fully load
        expect(await screen.findByText('Player One')).toBeInTheDocument()
        // No player-actions section in read-only mode
        expect(screen.queryByText('Player Actions')).not.toBeInTheDocument()
        // No initialize button
        expect(
            screen.queryByRole('button', { name: /add all users/i }),
        ).not.toBeInTheDocument()
    })

    test('edit controls visible when authenticated', async () => {
        renderMatchPage({ authenticated: true })
        // Wait for page to fully load
        expect(await screen.findByText('Player One')).toBeInTheDocument()
        // Player Actions zone is present
        expect(screen.getByText('Player Actions')).toBeInTheDocument()
        // Initialize button
        expect(
            await screen.findByRole('button', { name: /add all users/i }),
        ).toBeInTheDocument()
    })

    test('back link navigates to season page', async () => {
        const user = userEvent.setup()
        renderMatchPage()
        const backLink = await screen.findByRole('link', { name: /back to season/i })
        await user.click(backLink)
        expect(screen.getByText('Season Page')).toBeInTheDocument()
    })

    test('reset match button is visible when authenticated', async () => {
        renderMatchPage()
        expect(await screen.findByText('Player One')).toBeInTheDocument()
        expect(
            await screen.findByRole('button', { name: /reset match/i }),
        ).toBeInTheDocument()
    })

    test('reset match button hidden when not authenticated', async () => {
        renderMatchPage({ authenticated: false })
        expect(await screen.findByText('Player One')).toBeInTheDocument()
        expect(
            screen.queryByRole('button', { name: /reset match/i }),
        ).not.toBeInTheDocument()
    })

    test('reset match does nothing when confirm dialog is dismissed', async () => {
        const user = userEvent.setup()
        vi.spyOn(window, 'confirm').mockReturnValue(false)
        renderMatchPage()
        const resetBtn = await screen.findByRole('button', { name: /reset match/i })
        await user.click(resetBtn)
        expect(window.confirm).toHaveBeenCalled()
        vi.restoreAllMocks()
    })

    test('reset match resets score after confirming', async () => {
        const user = userEvent.setup()
        vi.spyOn(window, 'confirm').mockReturnValue(true)
        renderMatchPage()
        expect(await screen.findByText('Boston Bruins')).toBeInTheDocument()
        const resetBtn = await screen.findByRole('button', { name: /reset match/i })
        await user.click(resetBtn)
        expect(await screen.findByText('Match reset successfully')).toBeInTheDocument()
        vi.restoreAllMocks()
    })

    test('PP button opens Add Power Play Goal modal', async () => {
        const user = userEvent.setup()
        renderMatchPage()
        // Wait for entries to load
        await screen.findByText(/connor mcdavid/i)
        const ppBtn = screen.getByRole('button', { name: /^pp$/i })
        await user.click(ppBtn)
        expect(await screen.findByText('Add Power Play Goal')).toBeInTheDocument()
    })

    test('SH button opens Add Shorthanded Goal modal', async () => {
        const user = userEvent.setup()
        renderMatchPage()
        await screen.findByText(/connor mcdavid/i)
        const shBtn = screen.getByRole('button', { name: /^sh$/i })
        await user.click(shBtn)
        expect(await screen.findByText('Add Shorthanded Goal')).toBeInTheDocument()
    })

    test('clicking Penalty negative point chip triggers opponent goal event', async () => {
        const user = userEvent.setup()
        const postSpy = vi.spyOn(apiClient, 'post')
        renderMatchPage()
        await screen.findByText('Player One')

        // Find the Negative section and its Penalty chip
        const negativeLabel = screen.getByText('Negative')
        const negativeContainer = negativeLabel.closest('.bg-surface\\/50') || negativeLabel.parentElement?.parentElement
        const penaltyChip = within(negativeContainer as HTMLElement).getByRole('button', { name: /^penalty$/i })
        await user.click(penaltyChip)

        expect(postSpy).toHaveBeenCalledWith(
            expect.stringContaining('/api/usermatches/'),
            expect.objectContaining({ pointReasonId: 1, count: 1 })
        )
        expect(postSpy).toHaveBeenCalledWith(
            expect.stringContaining('/api/matches/10/events'),
            expect.objectContaining({ eventType: 'Goal', isOpponent: true })
        )
        postSpy.mockRestore()
    })

    test('loads all players\' points, goals and penalties in one request', async () => {
        const getSpy = vi.spyOn(apiClient, 'get')
        renderMatchPage()
        await screen.findByText(/connor mcdavid/i)

        const urls = getSpy.mock.calls.map(([url]) => String(url))
        expect(urls.filter((u) => u.includes('/usermatches/details'))).toHaveLength(1)
        expect(urls.filter((u) => /\/api\/usermatches\/\d+\/(points|goals|penalties)/.test(u))).toHaveLength(0)
        getSpy.mockRestore()
    })

    describe('season without plus/minus points', () => {
        test('hides the Negative and Positive point rows but keeps Neutral', async () => {
            useSeasonWithoutPoints()
            renderMatchPage()
            expect(await screen.findByText('Player One')).toBeInTheDocument()
            expect(screen.getByText('Neutral')).toBeInTheDocument()
            expect(screen.queryByText('Negative')).not.toBeInTheDocument()
            expect(screen.queryByText('Positive')).not.toBeInTheDocument()
            expect(screen.queryByText('+2')).not.toBeInTheDocument()
        })

        test('PP button records the goal directly without the point modal', async () => {
            useSeasonWithoutPoints()
            const user = userEvent.setup()
            const postSpy = vi.spyOn(apiClient, 'post')
            renderMatchPage()
            await screen.findByText(/connor mcdavid/i)

            await user.type(screen.getByPlaceholderText(/search player/i), 'Connor')
            await user.click(await screen.findByRole('button', { name: /connor mcdavid/i }))
            await user.click(screen.getByRole('button', { name: /^pp$/i }))

            expect(screen.queryByText('Add Power Play Goal')).not.toBeInTheDocument()
            expect(postSpy).toHaveBeenCalledWith(
                expect.stringMatching(/\/api\/usermatches\/\d+\/goals$/),
                expect.objectContaining({ goalType: 'PowerPlay' }),
            )
            expect(postSpy).not.toHaveBeenCalledWith(
                expect.stringMatching(/\/points$/),
                expect.anything(),
            )
            postSpy.mockRestore()
        })
    })
})
