import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Match } from '../types/match'
import { CompletionType, MatchPhase } from '../types/match'
import PlayoffBracket from '../components/season/PlayoffBracket'

function makeMatch(overrides: Partial<Match>): Match {
    return {
        id: 1,
        seasonId: 1,
        matchNumber: 1,
        homeTeamId: 10,
        homeTeamName: 'Home Team',
        homeTeamShortName: 'HOM',
        awayTeamId: 20,
        awayTeamName: 'Away Team',
        awayTeamShortName: 'AWY',
        homeScore: 0,
        awayScore: 0,
        matchDate: '2026-04-01T00:00:00Z',
        completionType: CompletionType.RegularTime,
        phase: MatchPhase.RegularSeason,
        playoffRound: null,
        ...overrides,
    }
}

describe('PlayoffBracket', () => {
    test('shows empty state when there are no playoff matches with a round', () => {
        render(<PlayoffBracket matches={[makeMatch({ phase: MatchPhase.RegularSeason })]} isDesktop={true} />)
        expect(screen.getByText(/no playoff rounds/i)).toBeInTheDocument()
    })

    test('groups playoff matches by round and shows the series winner once a team reaches 4 wins', () => {
        const round1: Match[] = Array.from({ length: 4 }, (_, i) =>
            makeMatch({
                id: 100 + i,
                matchNumber: 10 + i,
                phase: MatchPhase.Playoff,
                playoffRound: 1,
                homeTeamId: 10,
                awayTeamId: 20,
                homeTeamShortName: 'HOM',
                awayTeamShortName: 'AWY',
                homeScore: 4,
                awayScore: 1,
            }),
        )

        render(<PlayoffBracket matches={round1} isDesktop={true} />)

        expect(screen.getByText(/round 1/i)).toBeInTheDocument()
        expect(screen.getByText('HOM')).toBeInTheDocument()
        expect(screen.getByText('AWY')).toBeInTheDocument()
        expect(screen.getByText('4–0')).toBeInTheDocument()
    })

    test('clicking a duel expands it to show every match in that round', async () => {
        const user = userEvent.setup()
        const round1: Match[] = [
            makeMatch({ id: 1, matchNumber: 1, phase: MatchPhase.Playoff, playoffRound: 1, homeTeamId: 10, awayTeamId: 20, homeScore: 3, awayScore: 2 }),
            makeMatch({ id: 2, matchNumber: 2, phase: MatchPhase.Playoff, playoffRound: 1, homeTeamId: 20, awayTeamId: 10, homeScore: 1, awayScore: 4 }),
        ]

        render(<PlayoffBracket matches={round1} isDesktop={true} />)

        expect(screen.queryByText('3–2')).not.toBeInTheDocument()
        await user.click(screen.getByText(/round 1/i))
        expect(screen.getByText('3–2')).toBeInTheDocument()
        expect(screen.getByText('1–4')).toBeInTheDocument()
    })

    test('mobile view shows only the active round with working navigation arrows', async () => {
        const user = userEvent.setup()
        const matches: Match[] = [
            makeMatch({ id: 1, matchNumber: 1, phase: MatchPhase.Playoff, playoffRound: 1, homeTeamId: 10, awayTeamId: 20 }),
            makeMatch({ id: 2, matchNumber: 2, phase: MatchPhase.Playoff, playoffRound: 2, homeTeamId: 10, awayTeamId: 30, homeTeamShortName: 'HOM', awayTeamShortName: 'THR' }),
        ]

        render(<PlayoffBracket matches={matches} isDesktop={false} />)

        // Defaults to the most recent round.
        expect(screen.getByText(/round 2/i)).toBeInTheDocument()
        expect(screen.queryByText(/round 1/i)).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /previous round/i }))
        expect(screen.getByText(/round 1/i)).toBeInTheDocument()
    })
})
