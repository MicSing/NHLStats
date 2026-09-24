import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NextPlayoffSeriesPrompt from '../components/season/NextPlayoffSeriesPrompt'
import type { PlayoffStatus } from '../types/match'

const getMock = vi.fn()
const postMock = vi.fn()
vi.mock('../services/apiClient', () => ({
    default: {
        get: (...args: unknown[]) => getMock(...args),
        post: (...args: unknown[]) => postMock(...args),
    },
}))

const teams = [
    { id: 1, name: 'Anaheim Ducks', shortName: 'ANA', leagueType: 'NHL' },
    { id: 2, name: 'Boston Bruins', shortName: 'BOS', leagueType: 'NHL' },
    { id: 3, name: 'Calgary Flames', shortName: 'CGY', leagueType: 'NHL' },
    { id: 50, name: 'Slovakia', shortName: 'SVK', leagueType: 'IIHF' },
]

function playoffStatus(overrides: Partial<PlayoffStatus> = {}): PlayoffStatus {
    return {
        lastRound: 1,
        hostedWins: 4,
        opponentWins: 2,
        seriesDecided: true,
        hostedTeamWon: true,
        canCreateNextSeries: true,
        nextRound: 2,
        ...overrides,
    }
}

function mockApi(status: PlayoffStatus) {
    getMock.mockImplementation((url: string) =>
        Promise.resolve(url === '/api/teams' ? teams : status),
    )
}

describe('NextPlayoffSeriesPrompt', () => {
    beforeEach(() => {
        getMock.mockReset()
        postMock.mockReset()
    })

    it('renders nothing when a next series cannot be created', async () => {
        mockApi(playoffStatus({ canCreateNextSeries: false, nextRound: null }))
        const { container } = render(
            <NextPlayoffSeriesPrompt seasonId={1} hostedTeamId={1} leagueType="NHL" onCreated={vi.fn()} />,
        )
        await act(async () => {})

        expect(getMock).toHaveBeenCalledWith('/api/seasons/1/matches/playoff-status')
        expect(container).toBeEmptyDOMElement()
    })

    it('asks for the next opponent once the hosted team has won the round', async () => {
        mockApi(playoffStatus())
        render(<NextPlayoffSeriesPrompt seasonId={1} hostedTeamId={1} leagueType="NHL" onCreated={vi.fn()} />)

        expect(await screen.findByText('Anaheim Ducks won the series 4–2!')).toBeInTheDocument()
        expect(screen.getByText(/Choose the opponent for the 2nd Round/)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Generate matches' })).toBeDisabled()
    })

    it('creates the next series for the chosen opponent and notifies the parent', async () => {
        const user = userEvent.setup()
        const onCreated = vi.fn()
        mockApi(playoffStatus())
        postMock.mockResolvedValue([])

        render(<NextPlayoffSeriesPrompt seasonId={1} hostedTeamId={1} leagueType="NHL" onCreated={onCreated} />)

        await user.click(await screen.findByText('Select…'))
        expect(screen.queryByText('Slovakia')).not.toBeInTheDocument()
        await user.click(screen.getByText('Calgary Flames'))
        await user.click(screen.getByRole('button', { name: 'Generate matches' }))

        expect(postMock).toHaveBeenCalledWith('/api/seasons/1/matches/playoff-series', {
            opponentTeamId: 3,
            startsHome: true,
        })
        expect(onCreated).toHaveBeenCalled()
    })
})
