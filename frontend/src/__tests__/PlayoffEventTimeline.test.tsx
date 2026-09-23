import { render, screen } from '@testing-library/react'
import type { Match, MatchEvent } from '../types/match'
import { CompletionType, MatchPhase } from '../types/match'
import PlayoffEventTimeline from '../components/season/PlayoffEventTimeline'

const sampleMatch: Match = {
    id: 1,
    seasonId: 1,
    matchNumber: 1,
    homeTeamId: 10,
    homeTeamName: 'Edmonton Oilers',
    homeTeamShortName: 'EDM',
    awayTeamId: 20,
    awayTeamName: 'Florida Panthers',
    awayTeamShortName: 'FLA',
    homeScore: 3,
    awayScore: 2,
    matchDate: '2026-06-01T00:00:00Z',
    completionType: CompletionType.RegularTime,
    phase: MatchPhase.Playoff,
    playoffRound: 1,
}

describe('PlayoffEventTimeline', () => {
    test('renders empty notice when events array is empty', () => {
        render(<PlayoffEventTimeline events={[]} match={sampleMatch} hostedTeamId={10} />)
        expect(screen.getByText(/no event timeline recorded|pre tento zápas nie je zaznamenaná/i)).toBeInTheDocument()
    })

    test('renders period changes, match end, and teams headers', () => {
        const events: MatchEvent[] = [
            {
                id: 1,
                matchId: 1,
                orderIndex: 1,
                eventType: 'PeriodChange',
                isOpponent: false,
                eventSubtype: 'P1',
                userMatchGoalId: null,
                userMatchPenaltyId: null,
                userMatchPointId: null,
                rosterPlayerId: null,
                playerName: null,
                userMatchId: null,
                userName: null,
                pointReasonName: null,
                pointType: null,
                goalType: null,
                createdAt: '2026-06-01T00:00:00Z',
            },
            {
                id: 2,
                matchId: 1,
                orderIndex: 2,
                eventType: 'MatchEnd',
                isOpponent: false,
                eventSubtype: 'REG',
                userMatchGoalId: null,
                userMatchPenaltyId: null,
                userMatchPointId: null,
                rosterPlayerId: null,
                playerName: null,
                userMatchId: null,
                userName: null,
                pointReasonName: null,
                pointType: null,
                goalType: null,
                createdAt: '2026-06-01T00:00:00Z',
            },
        ]

        render(<PlayoffEventTimeline events={events} match={sampleMatch} hostedTeamId={10} />)

        expect(screen.getByText('Edmonton Oilers')).toBeInTheDocument()
        expect(screen.getByText('Florida Panthers')).toBeInTheDocument()
        expect(screen.getByText(/1st period|1\. tretina/i)).toBeInTheDocument()
        expect(screen.getByText(/match end|koniec zápasu/i)).toBeInTheDocument()
    })

    test('places home goal on home side and away goal on away side when home team is hosted', () => {
        const events: MatchEvent[] = [
            {
                id: 1,
                matchId: 1,
                orderIndex: 1,
                eventType: 'Goal',
                isOpponent: false,
                eventSubtype: null,
                userMatchGoalId: 101,
                userMatchPenaltyId: null,
                userMatchPointId: null,
                rosterPlayerId: 5,
                playerName: 'Connor McDavid',
                userMatchId: 1,
                userName: 'Martin',
                pointReasonName: null,
                pointType: null,
                goalType: 'PowerPlay',
                createdAt: '2026-06-01T00:00:00Z',
            },
            {
                id: 2,
                matchId: 1,
                orderIndex: 2,
                eventType: 'Goal',
                isOpponent: true,
                eventSubtype: null,
                userMatchGoalId: null,
                userMatchPenaltyId: null,
                userMatchPointId: null,
                rosterPlayerId: null,
                playerName: null,
                userMatchId: null,
                userName: null,
                pointReasonName: null,
                pointType: null,
                goalType: 'Regular',
                createdAt: '2026-06-01T00:00:00Z',
            },
        ]

        const { container } = render(
            <PlayoffEventTimeline events={events} match={sampleMatch} hostedTeamId={10} />
        )

        // Scorer Connor McDavid is displayed with PP badge
        expect(screen.getByText('Connor McDavid')).toBeInTheDocument()
        expect(screen.getByText('PP')).toBeInTheDocument()
        expect(screen.getByText('Martin')).toBeInTheDocument()

        // Opponent goal is displayed with opponent team name (header + card = 2 occurrences)
        expect(screen.getAllByText(/Florida Panthers/i)).toHaveLength(2)

        // Read-only verification: no drag controls or trash buttons
        expect(container.querySelectorAll('button')).toHaveLength(0)
    })

    test('correctly maps sides when away team is the hosted team', () => {
        // Hosted team is Florida Panthers (away team, id 20)
        const events: MatchEvent[] = [
            {
                id: 1,
                matchId: 1,
                orderIndex: 1,
                eventType: 'Goal',
                isOpponent: false, // Hosted team (Florida, away side) scored
                eventSubtype: null,
                userMatchGoalId: 201,
                userMatchPenaltyId: null,
                userMatchPointId: null,
                rosterPlayerId: 7,
                playerName: 'Aleksander Barkov',
                userMatchId: 1,
                userName: 'Peter',
                pointReasonName: null,
                pointType: null,
                goalType: 'ShortHanded',
                createdAt: '2026-06-01T00:00:00Z',
            },
            {
                id: 2,
                matchId: 1,
                orderIndex: 2,
                eventType: 'Goal',
                isOpponent: true, // Opponent (Edmonton, home side) scored
                eventSubtype: null,
                userMatchGoalId: null,
                userMatchPenaltyId: null,
                userMatchPointId: null,
                rosterPlayerId: null,
                playerName: null,
                userMatchId: null,
                userName: null,
                pointReasonName: null,
                pointType: null,
                goalType: 'Regular',
                createdAt: '2026-06-01T00:00:00Z',
            },
        ]

        render(
            <PlayoffEventTimeline events={events} match={sampleMatch} hostedTeamId={20} />
        )

        expect(screen.getByText('Aleksander Barkov')).toBeInTheDocument()
        expect(screen.getByText('SH')).toBeInTheDocument()
        expect(screen.getByText('Peter')).toBeInTheDocument()
        // Opponent goal for Edmonton Oilers (header + card = 2 occurrences)
        expect(screen.getAllByText(/Edmonton Oilers/i)).toHaveLength(2)
    })
})
