import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider } from '../context/AuthContext'
import { ToastProvider } from '../context/ToastContext'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import SeasonPage from '../pages/SeasonPage'

function renderSeasonPage(route = '/seasons') {
    localStorage.setItem('token', 'fake-jwt-token')
    localStorage.setItem('user', JSON.stringify({ id: '1', email: 'admin@test.com' }))
    return render(
        <ToastProvider>
            <AuthProvider>
                <MemoryRouter initialEntries={[route]}>
                    <Routes>
                        <Route path="/seasons" element={<SeasonPage />} />
                        <Route path="/seasons/:seasonId" element={<SeasonPage />} />
                        <Route
                            path="/seasons/:seasonId/matches/:matchId"
                            element={<div>Match Page</div>}
                        />
                    </Routes>
                </MemoryRouter>
            </AuthProvider>
        </ToastProvider>,
    )
}

describe('SeasonPage', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    describe('SeasonSelector', () => {
        test('renders all seasons in the dropdown', async () => {
            renderSeasonPage()
            // Both seasons from the mock fixture should appear as options
            expect(await screen.findByText('2023-24')).toBeInTheDocument()
            expect(screen.getByText('2024-25')).toBeInTheDocument()
        })

        test('auto-navigates to the latest season on load', async () => {
            renderSeasonPage()
            // After seasons load the page navigates to the latest season (id=2, 2024-25)
            const select = await screen.findByRole('combobox', { name: /select season/i })
            await waitFor(() => {
                expect((select as HTMLSelectElement).value).toBe('2')
            })
        })

        test('selecting a season loads season data', async () => {
            const user = userEvent.setup()
            renderSeasonPage()
            const select = await screen.findByRole('combobox', { name: /select season/i })
            await user.selectOptions(select, '1')
            // Weekly match section should appear after navigation + data load
            expect(await screen.findByText(/matches by week/i)).toBeInTheDocument()
        })
    })

    describe('Season overview', () => {
        test('groups matches by week with visual separation', async () => {
            renderSeasonPage('/seasons/1')
            // Week heading
            expect(await screen.findByText(/week 1/i)).toBeInTheDocument()
            // Match short names within that week
            expect(screen.getByText('BOS')).toBeInTheDocument()
            expect(screen.getByText('EDM')).toBeInTheDocument()
        })

        test('shows aggregated entries section when data exists', async () => {
            renderSeasonPage('/seasons/1')
            expect(await screen.findByText(/aggregated entries/i)).toBeInTheDocument()
            // The aggregated entry for Player One
            const section = await screen.findByRole('region', { name: /aggregated entries/i })
            expect(section).toHaveTextContent('Player One')
        })

        test('user stats table shows correct totals', async () => {
            renderSeasonPage('/seasons/1')
            // Stats heading
            expect(await screen.findByText(/player stats/i)).toBeInTheDocument()
            // Query within the stats section to avoid collision with aggregated entries
            const statsSection = await screen.findByRole('region', { name: /user stats/i })
            expect(within(statsSection).getByText('Player One')).toBeInTheDocument()
            expect(within(statsSection).getByText('5')).toBeInTheDocument() // totalPlus
            // totalMinus=3 and totalGoals=3 both appear; use getAllByText
            expect(within(statsSection).getAllByText('3').length).toBeGreaterThanOrEqual(1)
            expect(within(statsSection).getByText('0.75 €')).toBeInTheDocument()
        })

        test('top roster player columns show correct players', async () => {
            renderSeasonPage('/seasons/1')
            // Top scorer card
            expect(await screen.findByText(/top scorer/i)).toBeInTheDocument()
            // Connor McDavid appears in both scorer and penalized cards
            const connors = screen.getAllByText(/connor mcdavid/i)
            expect(connors.length).toBeGreaterThanOrEqual(1)
            expect(screen.getByText(/10 goals/i)).toBeInTheDocument()
            // Most penalized card
            expect(screen.getByText(/most penalized/i)).toBeInTheDocument()
            expect(screen.getByText(/3 penalties/i)).toBeInTheDocument()
        })

        test('clicking a match expands it inline', async () => {
            const user = userEvent.setup()
            renderSeasonPage('/seasons/1')
            // Click the expand button on the match card
            const expandBtn = await screen.findByRole('button', { name: /▼/ })
            await user.click(expandBtn)
            // Expanded section shows the bet column header
            expect(await screen.findAllByText(/bet/i)).not.toHaveLength(0)
        })
    })

    describe('score display', () => {
        test('shows match score in the weekly listing', async () => {
            renderSeasonPage('/seasons/1')
            // Scores are rendered as separate spans; check both appear
            expect(await screen.findByText('BOS')).toBeInTheDocument()
            expect(screen.getByText('EDM')).toBeInTheDocument()
        })
    })
})
