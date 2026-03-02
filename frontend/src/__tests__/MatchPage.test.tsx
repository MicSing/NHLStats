import { render, screen, waitFor, within } from '@testing-library/react'
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
        expect(await screen.findByText('Boston Bruins')).toBeInTheDocument()
        expect(screen.getByText('Edmonton Oilers')).toBeInTheDocument()
        expect(screen.getByText('3 – 2')).toBeInTheDocument()
    })

    test('renders all user entries for match', async () => {
        renderMatchPage()
        // UserMatch for "Player One"
        expect(await screen.findByText('Player One')).toBeInTheDocument()
        // totals: +2 / −1
        expect(screen.getByText('+2')).toBeInTheDocument()
        expect(screen.getByText('−1')).toBeInTheDocument()
    })

    test('shows existing point entries', async () => {
        renderMatchPage()
        // mockPoints: Penalty × 1
        expect(await screen.findByText(/penalty × 1/i)).toBeInTheDocument()
    })

    test('shows existing goal entries', async () => {
        renderMatchPage()
        // mockGoals: Connor McDavid × 1
        expect(await screen.findByText(/connor mcdavid × 1/i)).toBeInTheDocument()
    })

    test('point entry form submits with PointReason and count', async () => {
        const user = userEvent.setup()
        renderMatchPage()

        // Wait for form to appear
        const form = await screen.findByRole('form', { name: /add point for player one/i })
        expect(form).toBeInTheDocument()

        // Select a point reason (Penalty = id 1)
        const reasonSelect = within(form).getByRole('combobox', { name: /point reason/i })
        await user.selectOptions(reasonSelect, '1')

        // Submit using the Add button inside the point form
        await user.click(within(form).getByRole('button', { name: /^add$/i }))

        // After re-load, point entry should still be visible (MSW returns existing mock)
        await waitFor(() => {
            expect(screen.getByText(/penalty × 1/i)).toBeInTheDocument()
        })
    })

    test('goal form shows season roster in dropdown', async () => {
        renderMatchPage()
        // Wait for goal form to render
        await screen.findByRole('form', { name: /add goal for player one/i })
        const goalSelect = screen.getByRole('combobox', { name: /goal player/i })
        // Roster player from mockRosterPlayers: Connor McDavid
        expect(goalSelect).toHaveTextContent('Connor McDavid')
    })

    test('penalty form shows season roster in dropdown', async () => {
        renderMatchPage()
        await screen.findByRole('form', { name: /add penalty for player one/i })
        const penaltySelect = screen.getByRole('combobox', { name: /penalty player/i })
        expect(penaltySelect).toHaveTextContent('Connor McDavid')
    })

    test('edit controls hidden when not authenticated', async () => {
        renderMatchPage({ authenticated: false })
        // Wait for page to fully load
        expect(await screen.findByText('Player One')).toBeInTheDocument()
        // No add forms
        expect(
            screen.queryByRole('form', { name: /add point for/i }),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByRole('form', { name: /add goal for/i }),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByRole('form', { name: /add penalty for/i }),
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
        // Add forms should be present
        expect(
            screen.getByRole('form', { name: /add point for player one/i }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('form', { name: /add goal for player one/i }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('form', { name: /add penalty for player one/i }),
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
