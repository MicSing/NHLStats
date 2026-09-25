import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BettingTab, { type OddsUpdate } from '../components/betting/BettingTab'
import { ToastProvider } from '../context/ToastContext'
import type { MatchOddsDto } from '../types/bet'
import type { FutureMatch } from '../types/match'

const getMatchOdds = vi.fn()
vi.mock('../services/bettingService', () => ({
    bettingService: {
        getUpcoming: () => Promise.resolve(matches),
        listActive: () => Promise.resolve([]),
        getBalance: () => Promise.resolve({ availableBalance: 10, maxWinCap: 0, totalPositiveCash: 0, totalWonProfit: 0, totalPendingStake: 0 }),
        getMatchOdds: (id: number) => getMatchOdds(id),
    },
}))

const matches: FutureMatch[] = [1, 2].map((id) => ({
    id,
    seasonId: 1,
    seasonName: 'S1',
    matchNumber: id,
    homeTeamId: 10,
    homeTeamName: `Home ${id}`,
    awayTeamId: 20,
    awayTeamName: `Away ${id}`,
    hostedTeamId: 10,
    phase: 'Regular' as FutureMatch['phase'],
    playoffRound: null,
    userMatches: null,
}))

const emptyOdds: MatchOddsDto = {
    teamWin: null,
    userGoal: [],
    userPenalty: [],
    userPlusPoint: [],
    userMinusPoint: [],
    matchTotalGoals: [],
    hostedShutoutWinOdds: null,
    opponentShutoutWinOdds: null,
    computedOn: '2026-09-25T00:00:00Z',
}

function renderTab(oddsUpdate: OddsUpdate | null = null) {
    const onBalanceChanged = () => {}
    const ui = (update: OddsUpdate | null) => (
        <ToastProvider>
            <BettingTab userId={1} onBalanceChanged={onBalanceChanged} oddsUpdate={update} />
        </ToastProvider>
    )
    const result = render(ui(oddsUpdate))
    return { ...result, rerenderWith: (update: OddsUpdate | null) => result.rerender(ui(update)) }
}

describe('BettingTab odds loading', () => {
    beforeEach(() => {
        getMatchOdds.mockReset()
        getMatchOdds.mockResolvedValue(emptyOdds)
    })

    it('reuses already loaded odds when a match is selected again', async () => {
        const user = userEvent.setup()
        renderTab()
        await waitFor(() => expect(getMatchOdds).toHaveBeenCalledWith(1))

        await user.click(await screen.findByRole('button', { name: /Home 2/ }))
        await waitFor(() => expect(getMatchOdds).toHaveBeenCalledWith(2))

        await user.click(screen.getByRole('button', { name: /Home 1/ }))
        await user.click(screen.getByRole('button', { name: /Home 2/ }))

        expect(getMatchOdds).toHaveBeenCalledTimes(2)
    })

    it('refetches only the match named in an OddsUpdated event', async () => {
        const { rerenderWith } = renderTab()
        await waitFor(() => expect(getMatchOdds).toHaveBeenCalledTimes(1))

        rerenderWith({ matchId: 2, seq: 1 })
        await waitFor(() => expect(getMatchOdds).toHaveBeenCalledTimes(2))
        expect(getMatchOdds).toHaveBeenLastCalledWith(2)

        rerenderWith({ matchId: 2, seq: 2 })
        await waitFor(() => expect(getMatchOdds).toHaveBeenCalledTimes(3))
    })

    it('ignores OddsUpdated events for matches not shown on the page', async () => {
        const { rerenderWith } = renderTab()
        await waitFor(() => expect(getMatchOdds).toHaveBeenCalledTimes(1))

        rerenderWith({ matchId: 99, seq: 1 })
        await screen.findByRole('button', { name: /Home 1/ })

        expect(getMatchOdds).toHaveBeenCalledTimes(1)
    })
})
