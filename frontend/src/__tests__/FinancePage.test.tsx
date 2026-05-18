import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from './testUtils'
import FinancePage from '../pages/FinancePage'

// MSW handlers already provide:
//   GET /api/stats/financial-stats → { totalCollected:0.75, totalExpenses:80.0, canBeCollected:0, totalEarnings:0.75, expenses:[...], financesByUser:[{ userId:1, totalPluses:5, totalMinuses:3, collected:0.75, totalEarnings:0.75, canBeCollected:0, bettingBalance:0, stakes:0, betWins:0, betLosses:0, negativeCash:1.50 }] }
//   GET /api/users → [{ id:1, name:'Player One', isActive:true }, ...]
// Note: FinancePage uses € (euro) as the currency symbol.

// ── Earnings Table ──────────────────────────────────────────────────────────

describe('FinancePage — earnings table', () => {
    test('renders row for each user with Plus, Minus, Paid, Can Be Collected', async () => {
        renderWithProviders(<FinancePage />)
        await waitFor(() => expect(screen.getByText('Player One')).toBeInTheDocument())

        const row = screen.getByText('Player One').closest('tr')!
        expect(row).toHaveTextContent('5')       // totalPluses
        expect(row).toHaveTextContent('3')       // totalMinuses
        expect(row).toHaveTextContent('0.75 €')  // collected
    })

    test('totals row sums all users', async () => {
        renderWithProviders(<FinancePage />)
        await waitFor(() => expect(screen.getByText('Player One')).toBeInTheDocument())

        const table = screen.getByTestId('earnings-table')
        const tfoot = table.querySelector('tfoot')!
        expect(tfoot).toHaveTextContent('Total')
        expect(tfoot).toHaveTextContent('1.50 €')  // sum of negativeCash
        expect(tfoot).toHaveTextContent('80.00 €') // totalExpenses
    })

    test('handles users with no data gracefully', async () => {
        renderWithProviders(<FinancePage />)
        await waitFor(() => expect(screen.getByTestId('earnings-table')).toBeInTheDocument())
    })
})

// ── Expenses Table ──────────────────────────────────────────────────────────

describe('FinancePage — expenses table', () => {
    test('renders all expenses with description, amount, date', async () => {
        renderWithProviders(<FinancePage />)
        await waitFor(() => expect(screen.getByText('Pizza party')).toBeInTheDocument())

        expect(screen.getByText('Trophy')).toBeInTheDocument()
        expect(screen.getByText('50.00 €')).toBeInTheDocument()
        expect(screen.getByText('30.00 €')).toBeInTheDocument()
        expect(screen.getByText('2023-10-05')).toBeInTheDocument()
        expect(screen.getByText('2023-10-10')).toBeInTheDocument()
    })

    test('total expenses row shows sum', async () => {
        renderWithProviders(<FinancePage />)
        await waitFor(() => expect(screen.getByText('Pizza party')).toBeInTheDocument())

        const table = screen.getByTestId('expenses-table')
        const tfoot = table.querySelector('tfoot')!
        expect(tfoot).toHaveTextContent('80.00 €')
    })
})

// ── Balance Summary ─────────────────────────────────────────────────────────

describe('FinancePage — balance summary', () => {
    test('shows Can Be Collected, Total Collected, Total Expenses', async () => {
        renderWithProviders(<FinancePage />)
        await waitFor(() => expect(screen.getByTestId('balance-summary')).toBeInTheDocument())

        const summary = screen.getByTestId('balance-summary')
        expect(summary).toHaveTextContent(/can be collected/i)
        expect(summary).toHaveTextContent(/total collected/i)
        expect(summary).toHaveTextContent(/total expenses/i)
    })

    test('displays correct summary values', async () => {
        renderWithProviders(<FinancePage />)
        await waitFor(() => expect(screen.getByTestId('balance-summary')).toBeInTheDocument())

        const summary = screen.getByTestId('balance-summary')
        // canBeCollected = 0.75, totalCollected = 0.75, totalExpenses = 80.0
        const amounts = summary.querySelectorAll('.text-2xl')
        expect(amounts).toHaveLength(3)
    })
})
