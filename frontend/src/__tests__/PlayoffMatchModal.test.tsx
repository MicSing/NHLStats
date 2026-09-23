import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import apiClient from '../services/apiClient'
import type { Match, MatchEvent } from '../types/match'
import { CompletionType, MatchPhase } from '../types/match'
import PlayoffMatchModal from '../components/season/PlayoffMatchModal'

vi.mock('../services/apiClient', () => ({
    default: {
        get: vi.fn(),
    },
}))

const sampleMatch: Match = {
    id: 42,
    seasonId: 1,
    matchNumber: 1,
    homeTeamId: 10,
    homeTeamName: 'Edmonton Oilers',
    homeTeamShortName: 'EDM',
    awayTeamId: 20,
    awayTeamName: 'Florida Panthers',
    awayTeamShortName: 'FLA',
    homeScore: 3,
    awayScore: 1,
    matchDate: '2026-06-01T00:00:00Z',
    completionType: CompletionType.RegularTime,
    phase: MatchPhase.Playoff,
    playoffRound: 1,
}

describe('PlayoffMatchModal', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('shows timeline by default when events are present and allows switching to stats summary', async () => {
        const sampleEvents: MatchEvent[] = [
            {
                id: 1,
                matchId: 42,
                orderIndex: 1,
                eventType: 'Goal',
                isOpponent: false,
                eventSubtype: null,
                userMatchGoalId: 1,
                userMatchPenaltyId: null,
                userMatchPointId: null,
                rosterPlayerId: 97,
                playerName: 'Connor McDavid',
                userMatchId: 1,
                userName: 'Admin',
                pointReasonName: null,
                pointType: null,
                goalType: 'PowerPlay',
                createdAt: '2026-06-01T00:00:00Z',
            },
        ]

        vi.mocked(apiClient.get).mockImplementation((url: string) => {
            if (url.includes('/events')) {
                return Promise.resolve(sampleEvents) as never
            }
            if (url.includes('/usermatches')) {
                return Promise.resolve([]) as never
            }
            return Promise.resolve([]) as never
        })

        render(
            <MemoryRouter>
                <PlayoffMatchModal
                    match={sampleMatch}
                    seasonId={1}
                    roundName="Finále"
                    gameLabel="1. zápas"
                    hostedTeamId={10}
                    onClose={vi.fn()}
                />
            </MemoryRouter>
        )

        // Wait for timeline content to be rendered
        await waitFor(() => {
            expect(screen.getByText('Connor McDavid')).toBeInTheDocument()
        })

        // Tabs are present
        expect(screen.getByRole('button', { name: /timeline|časová os/i })).toBeInTheDocument()
        const statsTab = screen.getByRole('button', { name: /stats summary|súhrn štatistík/i })
        expect(statsTab).toBeInTheDocument()

        // Switch to stats summary tab
        await userEvent.click(statsTab)

        // 4 columns are shown
        expect(screen.getByRole('heading', { level: 3, name: /goals|góly/i })).toBeInTheDocument()
        expect(screen.getByRole('heading', { level: 3, name: /fouls|fauly/i })).toBeInTheDocument()
    })

    test('shows 4 columns directly without timeline tab when no events exist', async () => {
        vi.mocked(apiClient.get).mockImplementation((url: string) => {
            if (url.includes('/events')) {
                return Promise.resolve([]) as never
            }
            if (url.includes('/usermatches')) {
                return Promise.resolve([]) as never
            }
            return Promise.resolve([]) as never
        })

        render(
            <MemoryRouter>
                <PlayoffMatchModal
                    match={sampleMatch}
                    seasonId={1}
                    roundName="Finále"
                    gameLabel="1. zápas"
                    hostedTeamId={10}
                    onClose={vi.fn()}
                />
            </MemoryRouter>
        )

        await waitFor(() => {
            expect(screen.getByRole('heading', { level: 3, name: /goals|góly/i })).toBeInTheDocument()
        })

        // No tab switcher
        expect(screen.queryByRole('button', { name: /timeline|časová os/i })).not.toBeInTheDocument()
    })
})
