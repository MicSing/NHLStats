import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BettingBalanceTrendChart from '../components/charts/BettingBalanceTrendChart'
import { combineBalance } from '../utils/bettingBalance'
import { ThemeProvider } from '../context/ThemeContext'
import type { UserWeeklyBettingBalance, WeeklyBettingBalancePeriod } from '../types/stats'

const user: UserWeeklyBettingBalance = {
    userId: 1,
    userName: 'Alice',
    balance: 5,
    bets: 2,
    positivePoints: 3,
    negativePoints: -4,
    payouts: 6,
}

const data: WeeklyBettingBalancePeriod[] = [{ label: 'Week 1', users: [user] }]

describe('combineBalance', () => {
    it('sums only the selected components', () => {
        expect(combineBalance(user, { bets: true, positive: true, negative: false })).toBe(5)
        expect(combineBalance(user, { bets: true, positive: true, negative: true })).toBe(1)
        expect(combineBalance(user, { bets: false, positive: false, negative: true })).toBe(-4)
        expect(combineBalance(user, { bets: true, positive: false, negative: false })).toBe(2)
        expect(combineBalance(user, { bets: false, positive: false, negative: false })).toBe(0)
        expect(combineBalance(user, { bets: false, positive: false, negative: true, payouts: true })).toBe(2)
        expect(combineBalance(user, { bets: true, positive: true, negative: false, payouts: false })).toBe(5)
    })

    it('treats missing components as zero', () => {
        const legacy: UserWeeklyBettingBalance = { userId: 1, userName: 'Alice', balance: 5 }
        expect(combineBalance(legacy, { bets: true, positive: true, negative: true })).toBe(0)
    })
})

describe('BettingBalanceTrendChart', () => {
    it('renders bets and positive points checked by default, negative points unchecked', () => {
        render(<ThemeProvider><BettingBalanceTrendChart data={data} /></ThemeProvider>)

        expect(screen.getByRole('checkbox', { name: 'Bets' })).toBeChecked()
        expect(screen.getByRole('checkbox', { name: 'Positive points' })).toBeChecked()
        expect(screen.getByRole('checkbox', { name: 'Negative points' })).not.toBeChecked()
    })

    it('toggles components when checkboxes are clicked', async () => {
        const u = userEvent.setup()
        render(<ThemeProvider><BettingBalanceTrendChart data={data} /></ThemeProvider>)

        const negative = screen.getByRole('checkbox', { name: 'Negative points' })
        await u.click(negative)
        expect(negative).toBeChecked()

        const bets = screen.getByRole('checkbox', { name: 'Bets' })
        await u.click(bets)
        expect(bets).not.toBeChecked()
    })

    it('hides the payouts option unless showPayouts is set', () => {
        render(<ThemeProvider><BettingBalanceTrendChart data={data} /></ThemeProvider>)
        expect(screen.queryByRole('checkbox', { name: 'Paid' })).not.toBeInTheDocument()
    })

    it('shows the payouts option unchecked for the all-seasons view', async () => {
        const u = userEvent.setup()
        render(<ThemeProvider><BettingBalanceTrendChart data={data} showPayouts /></ThemeProvider>)

        const payouts = screen.getByRole('checkbox', { name: 'Paid' })
        expect(payouts).not.toBeChecked()
        await u.click(payouts)
        expect(payouts).toBeChecked()
    })
})
