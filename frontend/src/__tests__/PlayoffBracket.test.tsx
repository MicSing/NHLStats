import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
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
        render(
            <MemoryRouter>
                <PlayoffBracket matches={[makeMatch({ phase: MatchPhase.RegularSeason })]} />
            </MemoryRouter>
        )
        expect(screen.getByText(/no playoff rounds/i)).toBeInTheDocument()
    })

    test('NHL season: renders only created rounds in one row and hides uncreated rounds, without Winner label or trophy', () => {
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

        render(
            <MemoryRouter>
                <PlayoffBracket matches={round1} leagueType="NHL" />
            </MemoryRouter>
        )

        // Only Round 1 is created, so Round 1 is displayed
        expect(screen.getByText('1st Round')).toBeInTheDocument()

        // Uncreated rounds (2nd, Conference Final, Stanley Cup Final) are NOT shown
        expect(screen.queryByText('2nd Round')).not.toBeInTheDocument()
        expect(screen.queryByText('Conference Final')).not.toBeInTheDocument()
        expect(screen.queryByText('Stanley Cup Final')).not.toBeInTheDocument()

        // Matchup details for Round 1
        expect(screen.getAllByText('HOM')[0]).toBeInTheDocument()
        expect(screen.getAllByText('AWY')[0]).toBeInTheDocument()
        expect(screen.getByText('4–0')).toBeInTheDocument()

        // "Winner" / "Víťaz" label and trophy are removed
        expect(screen.queryByText(/^winner$/i)).not.toBeInTheDocument()
    })

    test('NHL season: renders multiple created rounds in one row and clicking a round updates matches below', async () => {
        const user = userEvent.setup()
        const matches: Match[] = [
            makeMatch({
                id: 1,
                matchNumber: 1,
                phase: MatchPhase.Playoff,
                playoffRound: 1,
                homeTeamId: 10,
                awayTeamId: 20,
                homeTeamShortName: 'HOM',
                awayTeamShortName: 'AWY',
                homeScore: 3,
                awayScore: 2,
            }),
            makeMatch({
                id: 2,
                matchNumber: 2,
                phase: MatchPhase.Playoff,
                playoffRound: 1,
                homeTeamId: 20,
                awayTeamId: 10,
                homeTeamShortName: 'AWY',
                awayTeamShortName: 'HOM',
                homeScore: 1,
                awayScore: 4,
            }),
            makeMatch({
                id: 3,
                matchNumber: 3,
                phase: MatchPhase.Playoff,
                playoffRound: 2,
                homeTeamId: 10,
                awayTeamId: 30,
                homeTeamShortName: 'HOM',
                awayTeamShortName: 'BOS',
                homeScore: 2,
                awayScore: 1,
            }),
        ]

        render(
            <MemoryRouter>
                <PlayoffBracket matches={matches} leagueType="NHL" />
            </MemoryRouter>
        )

        // Both created rounds (1 and 2) are displayed in the row
        expect(screen.getByText('1st Round')).toBeInTheDocument()
        expect(screen.getByText('2nd Round')).toBeInTheDocument()
        // Uncreated rounds are NOT shown
        expect(screen.queryByText('Conference Final')).not.toBeInTheDocument()
        expect(screen.queryByText('Stanley Cup Final')).not.toBeInTheDocument()

        // Initially displays the latest round (round 2) matches below
        expect(screen.getByText('Matches of 2nd Round')).toBeInTheDocument()
        expect(screen.getAllByText('BOS').length).toBeGreaterThan(0)

        // Click 1st Round in the row
        await user.click(screen.getByText('1st Round'))

        // Now displays round 1 matches
        expect(screen.getByText('Matches of 1st Round')).toBeInTheDocument()
        expect(screen.getByText('Game 1')).toBeInTheDocument()
        expect(screen.getByText('Game 2')).toBeInTheDocument()
        expect(screen.getByText('3')).toBeInTheDocument()
        expect(screen.getByText('4')).toBeInTheDocument()
    })

    test('NHL season: shows played matches and only the closest upcoming match, without a score', () => {
        const base = {
            phase: MatchPhase.Playoff,
            playoffRound: 1,
            homeTeamId: 10,
            awayTeamId: 20,
        }
        const matches: Match[] = [
            makeMatch({ ...base, id: 1, matchNumber: 1, homeScore: 5, awayScore: 2 }),
            makeMatch({ ...base, id: 2, matchNumber: 2, homeScore: 0, awayScore: 0, matchDate: null, completionType: CompletionType.None }),
            makeMatch({ ...base, id: 3, matchNumber: 3, homeScore: 0, awayScore: 0, matchDate: null, completionType: CompletionType.None }),
            makeMatch({ ...base, id: 4, matchNumber: 4, homeScore: 0, awayScore: 0, matchDate: null, completionType: CompletionType.None }),
        ]

        render(
            <MemoryRouter>
                <PlayoffBracket matches={matches} leagueType="NHL" />
            </MemoryRouter>
        )

        expect(screen.getByText('Game 1')).toBeInTheDocument()
        expect(screen.getByText('Game 2')).toBeInTheDocument()
        expect(screen.queryByText('Game 3')).not.toBeInTheDocument()
        expect(screen.queryByText('Game 4')).not.toBeInTheDocument()

        // Played match shows its score, upcoming match shows no 0:0 score
        expect(screen.getByText('5')).toBeInTheDocument()
        const upcomingCard = screen.getByText('Game 2').closest('[role="button"]') as HTMLElement
        expect(within(upcomingCard).queryByText('0')).not.toBeInTheDocument()
        expect(within(upcomingCard).getByText('vs')).toBeInTheDocument()
    })

    test('NHL season: clicking a match opens the match modal with event history timeline', async () => {
        const user = userEvent.setup()
        const round1: Match[] = [
            makeMatch({
                id: 10,
                matchNumber: 1,
                phase: MatchPhase.Playoff,
                playoffRound: 1,
                homeTeamId: 1,
                awayTeamId: 2,
                homeTeamShortName: 'BOS',
                awayTeamShortName: 'EDM',
                homeScore: 3,
                awayScore: 2,
            }),
        ]

        render(
            <MemoryRouter>
                <PlayoffBracket matches={round1} seasonId={1} leagueType="NHL" />
            </MemoryRouter>
        )

        // Find the match card in the list below and click it
        const matchCard = screen.getByText('Game 1')
        await user.click(matchCard)

        // Modal should open with dialog role and 4 columns
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByText('Goals')).toBeInTheDocument()
        expect(screen.getByText('Fouls')).toBeInTheDocument()
        expect(screen.getByText('Minus Points')).toBeInTheDocument()
        expect(screen.getByText('Plus Points')).toBeInTheDocument()

        // Ensure "Winner" badge is removed from modal
        expect(screen.queryByText(/^winner$/i)).not.toBeInTheDocument()

        // Close button works
        await user.click(screen.getByLabelText(/close/i))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    test('IIHF season: renders only created rounds and clicking a round directly opens the modal without displaying matches below', async () => {
        const user = userEvent.setup()
        const iihfMatches: Match[] = [
            makeMatch({
                id: 10,
                matchNumber: 1,
                phase: MatchPhase.Playoff,
                playoffRound: 1,
                homeTeamId: 1,
                awayTeamId: 2,
                homeTeamShortName: 'SVK',
                awayTeamShortName: 'CZE',
                homeScore: 4,
                awayScore: 2,
            }),
        ]

        render(
            <MemoryRouter>
                <PlayoffBracket matches={iihfMatches} seasonId={1} leagueType="IIHF" />
            </MemoryRouter>
        )

        // Quarterfinals is created, so it appears
        expect(screen.getByText('Quarterfinals')).toBeInTheDocument()
        // Uncreated rounds (Semifinals, Finals) do NOT appear
        expect(screen.queryByText('Semifinals')).not.toBeInTheDocument()
        expect(screen.queryByText('Finals')).not.toBeInTheDocument()

        // In IIHF, "Matches of Quarterfinals" section below does NOT exist (skipped)
        expect(screen.queryByText(/matches of quarterfinals/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/best of 7/i)).not.toBeInTheDocument()

        // Clicking the round directly opens the match modal
        await user.click(screen.getByText('Quarterfinals'))

        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByText('Goals')).toBeInTheDocument()
        expect(screen.getByText('Fouls')).toBeInTheDocument()
        expect(screen.getByText('Minus Points')).toBeInTheDocument()
        expect(screen.getByText('Plus Points')).toBeInTheDocument()
    })
})
