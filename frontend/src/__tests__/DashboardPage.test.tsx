import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext'
import DashboardPage from '../pages/DashboardPage'
import PlusMinusChart from '../components/charts/PlusMinusChart'
import TopScorersChart from '../components/charts/TopScorersChart'
import PenaltyLeadersChart from '../components/charts/PenaltyLeadersChart'
import EarningsChart from '../components/charts/EarningsChart'
import type { UserSeasonStats } from '../types/stats'
import type { UserEarnings } from '../types/stats'

function renderDashboard() {
    return render(
        <AuthProvider>
            <MemoryRouter initialEntries={['/dashboard']}>
                <Routes>
                    <Route path="/dashboard" element={<DashboardPage />} />
                </Routes>
            </MemoryRouter>
        </AuthProvider>,
    )
}

const mockStats: UserSeasonStats[] = [
    { userId: 1, userName: 'Player One', totalPlus: 5, totalMinus: 3, earnings: 0.75 },
    { userId: 2, userName: 'Player Two', totalPlus: 2, totalMinus: 7, earnings: -2.5 },
]

const mockEarnings: UserEarnings[] = [
    { userId: 1, userName: 'Player One', totalPlus: 5, totalMinus: 3, totalEarnings: 0.75 },
    { userId: 2, userName: 'Player Two', totalPlus: 2, totalMinus: 7, totalEarnings: -2.5 },
]

// ── PlusMinusChart ──────────────────────────────────────────────────────────

describe('PlusMinusChart', () => {
    test('renders with correct data points', () => {
        render(<PlusMinusChart data={mockStats} />)
        expect(screen.getByRole('img', { name: /plus minus chart/i })).toBeInTheDocument()
        expect(screen.getAllByText('Player One').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Player Two').length).toBeGreaterThan(0)
    })

    test('handles empty data gracefully', () => {
        render(<PlusMinusChart data={[]} />)
        expect(screen.getByText(/no data available/i)).toBeInTheDocument()
    })
})

// ── TopScorersChart ─────────────────────────────────────────────────────────

describe('TopScorersChart', () => {
    test('renders bars for each user', () => {
        render(<TopScorersChart data={mockStats} />)
        expect(screen.getByRole('img', { name: /top scorers chart/i })).toBeInTheDocument()
        expect(screen.getAllByText('Player One').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Player Two').length).toBeGreaterThan(0)
    })

    test('handles empty data gracefully', () => {
        render(<TopScorersChart data={[]} />)
        expect(screen.getByText(/no data available/i)).toBeInTheDocument()
    })
})

// ── PenaltyLeadersChart ─────────────────────────────────────────────────────

describe('PenaltyLeadersChart', () => {
    test('renders bars for each user', () => {
        render(<PenaltyLeadersChart data={mockStats} />)
        expect(screen.getByRole('img', { name: /penalty leaders chart/i })).toBeInTheDocument()
        expect(screen.getAllByText('Player One').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Player Two').length).toBeGreaterThan(0)
    })

    test('handles empty data gracefully', () => {
        render(<PenaltyLeadersChart data={[]} />)
        expect(screen.getByText(/no data available/i)).toBeInTheDocument()
    })
})

// ── EarningsChart ───────────────────────────────────────────────────────────

describe('EarningsChart', () => {
    test('renders cumulative line with user names', () => {
        render(<EarningsChart data={mockEarnings} />)
        expect(screen.getByRole('img', { name: /earnings chart/i })).toBeInTheDocument()
        expect(screen.getAllByText('Player One').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Player Two').length).toBeGreaterThan(0)
    })

    test('handles empty data gracefully', () => {
        render(<EarningsChart data={[]} />)
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

    test('shows earnings chart on load (all-time data)', async () => {
        renderDashboard()
        // Earnings section is always present (shows all-time data)
        expect(await screen.findByTestId('earnings-section')).toBeInTheDocument()
        // The earnings chart itself should be inside that section
        const section = screen.getByTestId('earnings-section')
        expect(section).toHaveTextContent(/all-time earnings/i)
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
