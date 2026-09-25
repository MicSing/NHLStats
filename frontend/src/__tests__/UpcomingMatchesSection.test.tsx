import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { rest } from 'msw'
import UpcomingMatchesSection from '../components/betting/UpcomingMatchesSection'
import { server } from '../mocks/server'
import type { FutureMatch, Matchup } from '../types/match'

const BASE = 'http://localhost:5000'

const match: FutureMatch = {
    id: 42,
    seasonId: 1,
    seasonName: 'S1',
    matchNumber: 7,
    homeTeamId: 1,
    homeTeamName: 'Boston Bruins',
    awayTeamId: 2,
    awayTeamName: 'Toronto Maple Leafs',
    hostedTeamId: 1,
    phase: 'RegularSeason',
    playoffRound: null,
    userMatches: null,
}

const emptyMatchup: Matchup = {
    matchId: 42,
    seasonId: 1,
    homeTeamId: 1,
    homeTeamName: 'Boston Bruins',
    awayTeamId: 2,
    awayTeamName: 'Toronto Maple Leafs',
    matchesPlayed: 0,
    lastMatches: [],
    topScorers: [],
    mostPenalized: [],
    mostPlusPoints: [],
    mostMinusPoints: [],
}

function mockMatchup(body: Matchup) {
    server.use(rest.get(`${BASE}/api/matches/42/matchup`, (_req, res, ctx) => res(ctx.json(body))))
}

describe('UpcomingMatchesSection', () => {
    it('marks the home and away team on the card', () => {
        render(<UpcomingMatchesSection matches={[match]} selectedMatchId={null} onSelect={() => {}} />)

        expect(screen.getByText('Home').nextSibling).toHaveTextContent('Boston Bruins')
        expect(screen.getByText('Away').nextSibling).toHaveTextContent('Toronto Maple Leafs')
    })

    it('selects the match when the card is clicked', async () => {
        const onSelect = vi.fn()
        render(<UpcomingMatchesSection matches={[match]} selectedMatchId={null} onSelect={onSelect} />)

        await userEvent.click(screen.getByText('Boston Bruins'))
        expect(onSelect).toHaveBeenCalledWith(42)
    })

    it('shows a notice when the teams have not played each other this season', async () => {
        mockMatchup(emptyMatchup)
        const onSelect = vi.fn()
        render(<UpcomingMatchesSection matches={[match]} selectedMatchId={null} onSelect={onSelect} />)

        await userEvent.click(screen.getByRole('button', { name: /season matchup for match #7/i }))

        const dialog = screen.getByRole('dialog')
        expect(within(dialog).getByText('Boston Bruins vs Toronto Maple Leafs')).toBeInTheDocument()
        expect(await within(dialog).findByText(/haven't played each other/i)).toBeInTheDocument()
        expect(onSelect).not.toHaveBeenCalled()
    })

    it('shows last results and leaders without numbers', async () => {
        mockMatchup({
            ...emptyMatchup,
            matchesPlayed: 1,
            lastMatches: [{
                id: 5, matchNumber: 3, homeTeamId: 2, homeTeamName: 'Toronto Maple Leafs',
                awayTeamId: 1, awayTeamName: 'Boston Bruins', homeScore: 2, awayScore: 4,
                matchDate: null, completionType: 2, phase: 'RegularSeason',
            }, {
                id: 6, matchNumber: 1, homeTeamId: 1, homeTeamName: 'Boston Bruins',
                awayTeamId: 2, awayTeamName: 'Toronto Maple Leafs', homeScore: 1, awayScore: 3,
                matchDate: null, completionType: 0, phase: 'RegularSeason',
            }],
            topScorers: [{ userId: 1, userName: 'Alice' }],
            mostPenalized: [{ userId: 2, userName: 'Bob' }],
            mostPlusPoints: [{ userId: 1, userName: 'Alice' }, { userId: 2, userName: 'Bob' }],
            mostMinusPoints: [],
        })
        render(<UpcomingMatchesSection matches={[match]} selectedMatchId={null} onSelect={() => {}} />)

        await userEvent.click(screen.getByRole('button', { name: /season matchup for match #7/i }))
        const dialog = screen.getByRole('dialog')

        expect(await within(dialog).findByText('2 : 4')).toBeInTheDocument()
        expect(within(dialog).getByText('OT')).toBeInTheDocument()
        expect(within(dialog).queryByText('N/A')).not.toBeInTheDocument()

        const [won, lost] = within(dialog).getAllByText('Boston Bruins', { selector: 'li span' })
        expect(won).toHaveClass('text-success')
        expect(lost).toHaveClass('text-danger')
        within(dialog).getAllByText('Toronto Maple Leafs', { selector: 'li span' })
            .forEach((el) => expect(el).not.toHaveClass('text-success', 'text-danger'))
        expect(within(dialog).getByText('Best scorer').nextSibling).toHaveTextContent(/^Alice$/)
        expect(within(dialog).getByText('Most penalized').nextSibling).toHaveTextContent(/^Bob$/)
        expect(within(dialog).getByText('Most plus points').nextSibling).toHaveTextContent(/^Alice, Bob$/)
        expect(within(dialog).getByText('Most minus points').nextSibling).toHaveTextContent('—')

        await userEvent.click(within(dialog).getByRole('button', { name: /close/i }))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
})
