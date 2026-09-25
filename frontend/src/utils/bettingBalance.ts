import type { UserWeeklyBettingBalance } from '../types/stats'

export interface BalanceComponents {
    bets: boolean
    positive: boolean
    negative: boolean
}

/** Sums the selected balance components; negativePoints is already ≤ 0. */
export function combineBalance(user: UserWeeklyBettingBalance, selected: BalanceComponents): number {
    return (selected.bets ? user.bets ?? 0 : 0)
        + (selected.positive ? user.positivePoints ?? 0 : 0)
        + (selected.negative ? user.negativePoints ?? 0 : 0)
}
