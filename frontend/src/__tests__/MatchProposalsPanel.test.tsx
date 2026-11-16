import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from './testUtils'
import MatchProposalsPanel from '../components/MatchProposalsPanel'
import type { MatchEventProposal } from '../types/collector'

const getMock = vi.fn()
const postMock = vi.fn()
vi.mock('../services/apiClient', () => ({
    default: {
        get: (...args: unknown[]) => getMock(...args),
        post: (...args: unknown[]) => postMock(...args),
    },
}))

function proposal(overrides: Partial<MatchEventProposal> = {}): MatchEventProposal {
    return {
        id: 1, matchId: 7, clientEventId: 'c1', apiKeyName: 'Collector PC', eventType: 'Goal', isOpponent: false,
        eventSubtype: null, goalType: 'Regular', userId: 10, userName: 'Michal', rosterPlayerId: 4,
        playerName: 'Nazem Kadri', assists: [], fightOutcome: null, period: 2, gameClock: '12:34', strength: null, confidence: 'Medium',
        note: null, mediaRef: null, occurredAt: null, status: 'Proposed', matchEventId: null,
        createdAt: '2026-11-16T14:00:00Z', resolvedAt: null, ...overrides,
    }
}

const userMatches = [{ id: 100, userId: 10, userName: 'Michal', matchId: 7, seasonId: 1 }]
const roster = [
    { id: 4, firstName: 'Nazem', surname: 'Kadri', position: 'C', teamId: 1, teamName: null, teamShortName: null, seasonId: 1, isActive: true },
    { id: 5, firstName: 'Nathan', surname: 'MacKinnon', position: 'C', teamId: 1, teamName: null, teamShortName: null, seasonId: 1, isActive: true },
]

describe('MatchProposalsPanel', () => {
    beforeEach(() => {
        getMock.mockReset()
        postMock.mockReset()
    })

    test('renders nothing when there are no proposals', async () => {
        getMock.mockResolvedValue([])
        const { container } = renderWithProviders(
            <MatchProposalsPanel matchId={7} userMatches={userMatches} roster={roster} onConfirmed={vi.fn()} />,
        )
        await waitFor(() => expect(getMock).toHaveBeenCalledWith('/api/matches/7/proposals?status=Proposed'))
        expect(container.querySelector('section')).toBeNull()
    })

    test('shows a proposal with who, period and clock, and confirms it as proposed', async () => {
        getMock.mockResolvedValueOnce([proposal()]).mockResolvedValue([])
        postMock.mockResolvedValue({})
        const onConfirmed = vi.fn()
        renderWithProviders(<MatchProposalsPanel matchId={7} userMatches={userMatches} roster={roster} onConfirmed={onConfirmed} />)

        expect(await screen.findByText('Michal · Nazem Kadri')).toBeInTheDocument()
        expect(screen.getByText(/Period 2 · 12:34/)).toBeInTheDocument()

        await userEvent.click(screen.getByRole('button', { name: /confirm/i }))
        await waitFor(() => expect(postMock).toHaveBeenCalledWith('/api/matches/7/proposals/1/confirm', {}))
        expect(onConfirmed).toHaveBeenCalled()
    })

    test('edit lets the admin change the player before confirming', async () => {
        getMock.mockResolvedValueOnce([proposal()]).mockResolvedValue([])
        postMock.mockResolvedValue({})
        renderWithProviders(<MatchProposalsPanel matchId={7} userMatches={userMatches} roster={roster} onConfirmed={vi.fn()} />)

        await userEvent.click(await screen.findByRole('button', { name: /edit/i }))
        await userEvent.selectOptions(screen.getByLabelText('Player'), '5')
        await userEvent.selectOptions(screen.getByLabelText('Goal type'), 'PowerPlay')
        await userEvent.click(screen.getByRole('button', { name: /confirm/i }))

        await waitFor(() => expect(postMock).toHaveBeenCalledWith('/api/matches/7/proposals/1/confirm', expect.objectContaining({
            userId: 10, rosterPlayerId: 5, goalType: 'PowerPlay', isOpponent: false, clearUser: false,
        })))
    })

    test('reject calls the reject endpoint and does not reload the match', async () => {
        getMock.mockResolvedValueOnce([proposal({ isOpponent: true, userId: null, userName: null })]).mockResolvedValue([])
        postMock.mockResolvedValue({})
        const onConfirmed = vi.fn()
        renderWithProviders(<MatchProposalsPanel matchId={7} userMatches={userMatches} roster={roster} onConfirmed={onConfirmed} />)

        await userEvent.click(await screen.findByRole('button', { name: /reject/i }))
        await waitFor(() => expect(postMock).toHaveBeenCalledWith('/api/matches/7/proposals/1/reject', {}))
        expect(onConfirmed).not.toHaveBeenCalled()
    })
})

describe('MatchProposalsPanel – assists and fights', () => {
    beforeEach(() => {
        getMock.mockReset()
        postMock.mockReset()
    })

    test('shows assists on a goal and lets the admin fix a fight outcome', async () => {
        getMock.mockResolvedValueOnce([
            proposal({ assists: [{ userId: 11, userName: 'Peter', rosterPlayerId: 6, playerName: 'Cale Makar' }] }),
            proposal({ id: 2, eventType: 'Fight', goalType: null, rosterPlayerId: null, playerName: null, fightOutcome: 'Won' }),
        ]).mockResolvedValue([])
        postMock.mockResolvedValue({})
        renderWithProviders(<MatchProposalsPanel matchId={7} userMatches={userMatches} roster={roster} onConfirmed={vi.fn()} />)

        expect(await screen.findByText(/Assists: Peter · Cale Makar/)).toBeInTheDocument()
        const fight = screen.getByTestId('proposal-2')
        expect(fight).toHaveTextContent('Fight: won')

        await userEvent.click(within(fight).getByRole('button', { name: /edit/i }))
        await userEvent.selectOptions(within(fight).getByLabelText('Fight outcome'), 'Draw')
        await userEvent.click(within(fight).getByRole('button', { name: /confirm/i }))
        await waitFor(() => expect(postMock).toHaveBeenCalledWith('/api/matches/7/proposals/2/confirm', expect.objectContaining({ fightOutcome: 'Draw' })))
    })
})
