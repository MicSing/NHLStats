import { screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from './testUtils'
import EarningsExpensesPage from '../pages/EarningsExpensesPage'

// MSW handlers already provide:
//   GET /api/stats/earnings → { userEarnings: [{ userId:1, userName:'Player One', totalPlus:5, totalMinus:3, totalEarnings:0.75 }], totalCollected:0.75, totalExpenses:80.0, balance:-79.25 }
//   GET /api/expenses → [{ id:1, description:'Pizza party', amount:50.0, date:'2023-10-05T00:00:00' }, { id:2, description:'Trophy', amount:30.0, date:'2023-10-10T00:00:00' }]
// Note: EarningsExpensesPage uses € (euro) as the currency symbol.

// ── Earnings Table ──────────────────────────────────────────────────────────

describe('EarningsExpensesPage — earnings table', () => {
    test('renders row for each user with Plus, Minus, Earnings', async () => {
        renderWithProviders(<EarningsExpensesPage />)
        await waitFor(() => expect(screen.getByText('Player One')).toBeInTheDocument())

        const row = screen.getByText('Player One').closest('tr')!
        expect(row).toHaveTextContent('5')       // totalPlus
        expect(row).toHaveTextContent('3')       // totalMinus
        expect(row).toHaveTextContent('0.75 €')   // totalEarnings
    })

    test('totals row sums all users', async () => {
        renderWithProviders(<EarningsExpensesPage />)
        await waitFor(() => expect(screen.getByText('Player One')).toBeInTheDocument())

        const table = screen.getByTestId('earnings-table')
        const tfoot = table.querySelector('tfoot')!
        expect(tfoot).toHaveTextContent('Total')
        expect(tfoot).toHaveTextContent('5')       // sum of totalPlus
        expect(tfoot).toHaveTextContent('3')       // sum of totalMinus
        expect(tfoot).toHaveTextContent('0.75 €')   // sum of totalEarnings
    })

    test('handles users with no data gracefully', async () => {
        renderWithProviders(<EarningsExpensesPage />)
        await waitFor(() => expect(screen.getByTestId('earnings-table')).toBeInTheDocument())
    })
})

// ── Expenses Table ──────────────────────────────────────────────────────────

describe('EarningsExpensesPage — expenses table', () => {
    test('renders all expenses with description, amount, date', async () => {
        renderWithProviders(<EarningsExpensesPage />)
        await waitFor(() => expect(screen.getByText('Pizza party')).toBeInTheDocument())

        expect(screen.getByText('Trophy')).toBeInTheDocument()
        expect(screen.getByText('50.00 €')).toBeInTheDocument()
        expect(screen.getByText('30.00 €')).toBeInTheDocument()
        expect(screen.getByText('2023-10-05')).toBeInTheDocument()
        expect(screen.getByText('2023-10-10')).toBeInTheDocument()
    })

    test('total expenses row shows sum', async () => {
        renderWithProviders(<EarningsExpensesPage />)
        await waitFor(() => expect(screen.getByText('Pizza party')).toBeInTheDocument())

        const table = screen.getByTestId('expenses-table')
        const tfoot = table.querySelector('tfoot')!
        expect(tfoot).toHaveTextContent('80.00 €')
    })
})

// ── Balance Summary ─────────────────────────────────────────────────────────

describe('EarningsExpensesPage — balance summary', () => {
    test('shows Total Collected, Total Expenses, Remaining', async () => {
        renderWithProviders(<EarningsExpensesPage />)
        await waitFor(() => expect(screen.getByTestId('balance-summary')).toBeInTheDocument())

        expect(screen.getByText(/total collected/i)).toBeInTheDocument()
        expect(screen.getByText(/total expenses/i)).toBeInTheDocument()
        expect(screen.getByText(/remaining/i)).toBeInTheDocument()
    })

    test('Remaining = Total collected − Total expenses', async () => {
        renderWithProviders(<EarningsExpensesPage />)
        await waitFor(() => expect(screen.getByTestId('balance-summary')).toBeInTheDocument())

        const summary = screen.getByTestId('balance-summary')
        // totalCollected = 0.75 → "0.75 €"
        within(summary).getAllByText('0.75 €')
        // balance = 0.75 − 80 = −79.25 → "-79.25 €"
        within(summary).getByText('-79.25 €')
    })
})
