import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OddsRecalculationStatus from '../components/season/OddsRecalculationStatus'
import type { OddsRecalculationStatus as Status } from '../types/match'

const getMock = vi.fn()
const postMock = vi.fn()
vi.mock('../services/apiClient', () => ({
    default: {
        get: (...args: unknown[]) => getMock(...args),
        post: (...args: unknown[]) => postMock(...args),
    },
}))

function status(overrides: Partial<Status> = {}): Status {
    return {
        inProgress: false,
        pending: 0,
        completed: 0,
        failed: 0,
        pendingMatchIds: [],
        completedMatchIds: [],
        startedAt: null,
        lastError: null,
        ...overrides,
    }
}

describe('OddsRecalculationStatus', () => {
    beforeEach(() => {
        getMock.mockReset()
        postMock.mockReset()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('renders nothing when no calculation is running', async () => {
        getMock.mockResolvedValue(status())
        const { container } = render(<OddsRecalculationStatus seasonId={1} />)

        await act(async () => {})

        expect(getMock).toHaveBeenCalledWith('/api/admin/seasons/1/odds-status')
        expect(container).toBeEmptyDOMElement()
    })

    it('shows progress while running, keeps polling, and reports when odds are ready', async () => {
        vi.useFakeTimers()
        const onPendingChange = vi.fn()
        getMock
            .mockResolvedValueOnce(status({ inProgress: true, pending: 2, completed: 2, pendingMatchIds: [7, 8], completedMatchIds: [5, 6] }))
            .mockResolvedValueOnce(status({ completed: 4, completedMatchIds: [5, 6, 7, 8] }))

        render(<OddsRecalculationStatus seasonId={1} onPendingChange={onPendingChange} />)
        await act(async () => {})

        expect(screen.getByRole('status')).toHaveTextContent('Calculating betting odds for new games… 2/4')
        expect(onPendingChange).toHaveBeenLastCalledWith([7, 8])

        await act(async () => {
            await vi.advanceTimersByTimeAsync(2000)
        })

        expect(getMock).toHaveBeenCalledTimes(2)
        expect(screen.getByRole('status')).toHaveTextContent('Betting odds for the new games are ready.')
        expect(onPendingChange).toHaveBeenLastCalledWith([])

        await act(async () => {
            await vi.advanceTimersByTimeAsync(10_000)
        })
        expect(getMock).toHaveBeenCalledTimes(2)
    })

    it('starts polling again when the refresh key changes', async () => {
        getMock.mockResolvedValue(status())
        const { rerender } = render(<OddsRecalculationStatus seasonId={1} refreshKey={0} />)
        await act(async () => {})
        expect(getMock).toHaveBeenCalledTimes(1)

        getMock.mockResolvedValue(status({ inProgress: true, pending: 4, pendingMatchIds: [1, 2, 3, 4] }))
        rerender(<OddsRecalculationStatus seasonId={1} refreshKey={1} />)
        await act(async () => {})

        expect(getMock).toHaveBeenCalledTimes(2)
        expect(screen.getByRole('status')).toHaveTextContent('0/4')
    })

    it('shows the error and retries the upcoming-odds calculation', async () => {
        const user = userEvent.setup()
        getMock.mockResolvedValue(status({ completed: 3, failed: 1, lastError: 'db locked' }))
        postMock.mockResolvedValue({ matchesUpdated: 4 })

        render(<OddsRecalculationStatus seasonId={1} />)

        expect(await screen.findByRole('alert')).toHaveTextContent('db locked')
        await user.click(screen.getByRole('button', { name: 'Retry' }))

        expect(postMock).toHaveBeenCalledWith('/api/admin/odds/recalculate-upcoming', {})
        expect(await screen.findByRole('status')).toHaveTextContent('Betting odds for the new games are ready.')
    })
})
