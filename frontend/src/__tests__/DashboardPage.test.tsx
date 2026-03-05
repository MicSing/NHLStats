import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext'
import { ThemeProvider } from '../context/ThemeContext'
import DashboardPage from '../pages/DashboardPage'
import PlusMinusChart from '../components/charts/PlusMinusChart'
import TopScorersChart from '../components/charts/TopScorersChart'
import PenaltyLeadersChart from '../components/charts/PenaltyLeadersChart'
import EarningsChart from '../components/charts/EarningsChart'
import type { UserSeasonStats, RosterScorerByUser, RosterPenalizedByUser } from '../types/stats'
import type { SeasonEarningsEntry } from '../types/stats'

function renderDashboard() {
    return render(
        <ThemeProvider>
            <AuthProvider>
                <MemoryRouter initialEntries={['/dashboard']}>
                    <Routes>
                        <Route path="/dashboard" element={<DashboardPage />} />
                    </Routes>
                </MemoryRouter>
            </AuthProvider>
        </ThemeProvider>,
    )
}

const mockStats: UserSeasonStats[] = [
    { userId: 1, userName: 'Player One', totalPlus: 5, totalMinus: 3, earnings: 0.75 },
    { userId: 2, userName: 'Player Two', totalPlus: 2, totalMinus: 7, earnings: -2.5 },
]

const mockRosterScorers: RosterScorerByUser[] = [
    {
        rosterPlayerId: 1,
        firstName: 'Player',
        surname: 'One',
        teamShortName: null,
        totalCount: 10,
        userCounts: [{ userId: 1, userName: 'Player One', count: 10 }],
    },
    {
        rosterPlayerId: 2,
        firstName: 'Player',
        surname: 'Two',
        teamShortName: null,
        totalCount: 7,
        userCounts: [{ userId: 2, userName: 'Player Two', count: 7 }],
    },
]

const mockRosterPenalized: RosterPenalizedByUser[] = [
    {
        rosterPlayerId: 1,
        firstName: 'Player',
        surname: 'One',
        teamShortName: null,
        totalCount: 10,
        userCounts: [{ userId: 1, userName: 'Player One', count: 10 }],
    },
    {
        rosterPlayerId: 2,
        firstName: 'Player',
        surname: 'Two',
        teamShortName: null,
        totalCount: 7,
        userCounts: [{ userId: 2, userName: 'Player Two', count: 7 }],
    },
]

const mockEarningsBySeason: SeasonEarningsEntry[] = [
    {
        seasonId: 1,
        seasonName: '2023-24',
        users: [
            { userId: 1, userName: 'Player One', earnings: 0.50 },
            { userId: 2, userName: 'Player Two', earnings: 1.25 },
        ],
    },
    {
        seasonId: 2,
        seasonName: '2024-25',
        users: [
            { userId: 1, userName: 'Player One', earnings: 0.25 },
        ],
    },
]

// ── PlusMinusChart ──────────────────────────────────────────────────────────

describe('PlusMinusChart', () => {
    test('renders with correct data points', () => {
        render(<ThemeProvider><PlusMinusChart data={mockStats} /></ThemeProvider>)
        expect(screen.getByRole('img', { name: /plus minus chart/i })).toBeInTheDocument()
        expect(screen.getAllByText('Player One').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Player Two').length).toBeGreaterThan(0)
    })

    test('handles empty data gracefully', () => {
        render(<ThemeProvider><PlusMinusChart data={[]} /></ThemeProvider>)
        expect(screen.getByText(/no data available/i)).toBeInTheDocument()
    })
})

// ── TopScorersChart ─────────────────────────────────────────────────────────

describe('TopScorersChart', () => {
    test('renders bars for each roster player', () => {
        render(<ThemeProvider><TopScorersChart data={mockRosterScorers} /></ThemeProvider>)
        expect(screen.getByRole('img', { name: /top scorers chart/i })).toBeInTheDocument()
        expect(screen.getAllByText('Player One').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Player Two').length).toBeGreaterThan(0)
    })

    test('handles empty data gracefully', () => {
        render(<ThemeProvider><TopScorersChart data={[]} /></ThemeProvider>)
        expect(screen.getByText(/no data available/i)).toBeInTheDocument()
    })
})

// ── PenaltyLeadersChart ─────────────────────────────────────────────────────

describe('PenaltyLeadersChart', () => {
    test('renders bars for each roster player', () => {
        render(<ThemeProvider><PenaltyLeadersChart data={mockRosterPenalized} /></ThemeProvider>)
        expect(screen.getByRole('img', { name: /penalty leaders chart/i })).toBeInTheDocument()
        expect(screen.getAllByText('Player One').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Player Two').length).toBeGreaterThan(0)
    })

    test('handles empty data gracefully', () => {
        render(<ThemeProvider><PenaltyLeadersChart data={[]} /></ThemeProvider>)
        expect(screen.getByText(/no data available/i)).toBeInTheDocument()
    })
})

// ── EarningsChart ───────────────────────────────────────────────────────────

describe('EarningsChart', () => {
    test('renders stacked bars with user names', () => {
        render(<ThemeProvider><EarningsChart data={mockEarningsBySeason} selectedSeasonId={null} /></ThemeProvider>)
        expect(screen.getByRole('img', { name: /earnings chart/i })).toBeInTheDocument()
        expect(screen.getAllByText('Player One').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Player Two').length).toBeGreaterThan(0)
    })

    test('handles empty data gracefully', () => {
        render(<ThemeProvider><EarningsChart data={[]} selectedSeasonId={null} /></ThemeProvider>)
        expect(screen.getByText(/no data available/i)).toBeInTheDocument()
    })
})

// ── DashboardPage ───────────────────────────────────────────────────────────

describe('DashboardPage', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    test('renders page heading', async () => {
        renderDashboard()
        expect(await screen.findByRole('heading', { name: /dashboard/i })).toBeInTheDocument()
    })

    test('loads and shows all seasons in selector', async () => {
        renderDashboard()
        expect(await screen.findByText('2023-24')).toBeInTheDocument()
        expect(screen.getByText('2024-25')).toBeInTheDocument()
    })

    test('shows earnings chart on load', async () => {
        renderDashboard()
        // Earnings section is always present
        expect(await screen.findByTestId('earnings-section')).toBeInTheDocument()
        // When a season is auto-selected, the section shows "Season Earnings"
        const section = screen.getByTestId('earnings-section')
        expect(section).toHaveTextContent(/season earnings/i)
    })

    test('season filter updates plus/minus chart data', async () => {
        const user = userEvent.setup()
        renderDashboard()
        const select = await screen.findByRole('combobox', { name: /select season/i })
        await user.selectOptions(select, '1')
        // After selecting season 1, Player One should appear in plus/minus chart
        await waitFor(() => {
            expect(screen.getByRole('img', { name: /plus minus chart/i })).toBeInTheDocument()
        })
        expect(screen.getAllByText('Player One').length).toBeGreaterThan(0)
    })

    test('season filter updates top scorers chart data', async () => {
        const user = userEvent.setup()
        renderDashboard()
        const select = await screen.findByRole('combobox', { name: /select season/i })
        await user.selectOptions(select, '1')
        await waitFor(() => {
            expect(screen.getByRole('img', { name: /top scorers chart/i })).toBeInTheDocument()
        })
    })

    test('season filter updates penalty leaders chart data', async () => {
        const user = userEvent.setup()
        renderDashboard()
        const select = await screen.findByRole('combobox', { name: /select season/i })
        await user.selectOptions(select, '1')
        await waitFor(() => {
            expect(screen.getByRole('img', { name: /penalty leaders chart/i })).toBeInTheDocument()
        })
    })

    test('charts show no data placeholder when no season selected', async () => {
        renderDashboard()
        // Wait for page to render
        await screen.findByRole('heading', { name: /dashboard/i })
        // Season-specific charts should show no-data placeholder before a season is chosen
        const noDataMessages = await screen.findAllByText(/no data available/i)
        expect(noDataMessages.length).toBeGreaterThanOrEqual(1)
    })
})
