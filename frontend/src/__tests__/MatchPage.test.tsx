import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext'
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
        </AuthProvider>,
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
        // In auth mode, score is rendered as editable number inputs
        expect(screen.getByRole('spinbutton', { name: /home score/i })).toHaveValue(3)
        expect(screen.getByRole('spinbutton', { name: /away score/i })).toHaveValue(2)
    })

    test('renders all user entries for match', async () => {
        renderMatchPage()
        // UserMatch for "Player One"
        expect(await screen.findByText('Player One')).toBeInTheDocument()
        // totals: +2 / −1
        expect(screen.getByText('+2')).toBeInTheDocument()
        expect(screen.getByText('−1')).toBeInTheDocument()
    })

    test('shows existing goal entries on Goals tab (default)', async () => {
        renderMatchPage()
        // Goals tab is the default — goal chip shows "Connor McDavid × 1"
        expect(await screen.findByText(/connor mcdavid × 1/i)).toBeInTheDocument()
    })

    test('shows existing point entries after switching to Points tab', async () => {
        const user = userEvent.setup()
        renderMatchPage()
        // Points are only shown when the Points tab is active
        const pointsTab = await screen.findByRole('button', { name: /^points/i })
        await user.click(pointsTab)
        // mockPoints: Penalty × 1
        expect(await screen.findByText(/penalty × 1/i)).toBeInTheDocument()
    })

    test('goal form is visible in Goals tab when authenticated', async () => {
        renderMatchPage()
        // Goals tab is default — form should be present once data loads
        const form = await screen.findByRole('form', { name: /add goal for player one/i })
        expect(form).toBeInTheDocument()
    })

    test('penalty form is visible in Penalties tab when authenticated', async () => {
        const user = userEvent.setup()
        renderMatchPage()
        // Navigate to Penalties tab
        const penaltiesTab = await screen.findByRole('button', { name: /^penalties/i })
        await user.click(penaltiesTab)
        const form = await screen.findByRole('form', { name: /add penalty for player one/i })
        expect(form).toBeInTheDocument()
    })

    test('Points tab shows + Positive and + Negative action buttons when authenticated', async () => {
        const user = userEvent.setup()
        renderMatchPage()
        const pointsTab = await screen.findByRole('button', { name: /^points/i })
        await user.click(pointsTab)
        expect(await screen.findByRole('button', { name: /\+ positive/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /\+ negative/i })).toBeInTheDocument()
    })

    test('edit controls hidden when not authenticated', async () => {
        renderMatchPage({ authenticated: false })
        // Wait for page to fully load
        expect(await screen.findByText('Player One')).toBeInTheDocument()
        // No goal form in default Goals tab when not authenticated
        expect(
            screen.queryByRole('form', { name: /add goal for/i }),
        ).not.toBeInTheDocument()
        // No initialize button
        expect(
            screen.queryByRole('button', { name: /initialize users/i }),
        ).not.toBeInTheDocument()
    })

    test('edit controls visible when authenticated', async () => {
        renderMatchPage({ authenticated: true })
        // Wait for page to fully load
        expect(await screen.findByText('Player One')).toBeInTheDocument()
        // Goal form is present in the default Goals tab
        expect(
            screen.getByRole('form', { name: /add goal for player one/i }),
        ).toBeInTheDocument()
        // Initialize button
        expect(
            screen.getByRole('button', { name: /initialize users/i }),
        ).toBeInTheDocument()
    })

    test('back link navigates to season page', async () => {
        const user = userEvent.setup()
        renderMatchPage()
        const backLink = await screen.findByRole('link', { name: /back to season/i })
        await user.click(backLink)
        expect(screen.getByText('Season Page')).toBeInTheDocument()
    })
})
