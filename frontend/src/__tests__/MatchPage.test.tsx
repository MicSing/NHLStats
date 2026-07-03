import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext'
import { ToastProvider } from '../context/ToastContext'
import MatchPage from '../pages/MatchPage'

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
        // In auth mode, score is rendered as a label with +/− buttons
        expect(screen.getByLabelText(/increase home score/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/increase away score/i)).toBeInTheDocument()
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
        expect(screen.getByRole('button', { name: /^goal$/i })).toBeInTheDocument()
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
})
