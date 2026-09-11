import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BettingAdminTab from '../components/finance/BettingAdminTab'

const postMock = vi.fn()
vi.mock('../services/apiClient', () => ({
    default: {
        post: (...args: unknown[]) => postMock(...args),
    },
}))

function renderTab() {
    return render(<BettingAdminTab />)
}

describe('BettingAdminTab', () => {
    beforeEach(() => {
        postMock.mockReset()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('recalculates upcoming match odds without a confirmation prompt', async () => {
        const user = userEvent.setup()
        const confirmSpy = vi.spyOn(window, 'confirm')
        postMock.mockResolvedValueOnce({ matchesUpdated: 4 })

        renderTab()
        await user.click(screen.getByRole('button', { name: 'Recalculate Upcoming Odds' }))

        expect(confirmSpy).not.toHaveBeenCalled()
        expect(postMock).toHaveBeenCalledWith('/api/admin/odds/recalculate-upcoming', {})
        expect(await screen.findByRole('status')).toHaveTextContent('Recalculated odds for 4 upcoming match(es).')
    })

    it('does not call the API when the historical-odds confirmation is dismissed', async () => {
        const user = userEvent.setup()
        vi.spyOn(window, 'confirm').mockReturnValue(false)

        renderTab()
        await user.click(screen.getByRole('button', { name: 'Recalculate Historical Odds' }))

        expect(postMock).not.toHaveBeenCalled()
    })

    it('recalculates historical ticket odds to the current formula (2.1) by default', async () => {
        const user = userEvent.setup()
        vi.spyOn(window, 'confirm').mockReturnValue(true)
        postMock.mockResolvedValueOnce({ betsUpdated: 7 })

        renderTab()
        await user.click(screen.getByRole('button', { name: 'Recalculate Historical Odds' }))

        expect(postMock).toHaveBeenCalledWith('/api/admin/bets/recalculate-historical-odds', { targetVersion: 2.1 })
        expect(await screen.findByRole('status')).toHaveTextContent('Recalculated 7 historical ticket(s).')
    })

    it('sends the historical formula version (2.0) when that option is selected', async () => {
        const user = userEvent.setup()
        vi.spyOn(window, 'confirm').mockReturnValue(true)
        postMock.mockResolvedValueOnce({ betsUpdated: 5 })

        renderTab()
        await user.selectOptions(screen.getByLabelText('Formula version:'), 'Historical (2.0)')
        await user.click(screen.getByRole('button', { name: 'Recalculate Historical Odds' }))

        expect(postMock).toHaveBeenCalledWith('/api/admin/bets/recalculate-historical-odds', { targetVersion: 2 })
    })

    it('sends the legacy formula version (1.0) when that option is selected', async () => {
        const user = userEvent.setup()
        vi.spyOn(window, 'confirm').mockReturnValue(true)
        postMock.mockResolvedValueOnce({ betsUpdated: 3 })

        renderTab()
        await user.selectOptions(screen.getByLabelText('Formula version:'), 'Legacy (1.0)')
        await user.click(screen.getByRole('button', { name: 'Recalculate Historical Odds' }))

        expect(postMock).toHaveBeenCalledWith('/api/admin/bets/recalculate-historical-odds', { targetVersion: 1 })
    })

    it('shows a persistent error panel when the historical recalculation fails', async () => {
        const user = userEvent.setup()
        vi.spyOn(window, 'confirm').mockReturnValue(true)
        postMock.mockRejectedValueOnce(new Error('boom'))

        renderTab()
        await user.click(screen.getByRole('button', { name: 'Recalculate Historical Odds' }))

        expect(await screen.findByRole('status')).toHaveTextContent('Failed to recalculate historical odds. Please try again.')
    })

    it('shows a running label while the request is in flight and disables the other buttons', async () => {
        const user = userEvent.setup()
        let resolvePost: (value: { matchesUpdated: number }) => void = () => { }
        postMock.mockReturnValueOnce(new Promise((resolve) => { resolvePost = resolve }))

        renderTab()
        await user.click(screen.getByRole('button', { name: 'Recalculate Upcoming Odds' }))

        expect(screen.getByRole('button', { name: /Recalculating…/ })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Recalculate Historical Odds' })).toBeDisabled()

        resolvePost({ matchesUpdated: 0 })
        expect(await screen.findByRole('button', { name: 'Recalculate Historical Odds' })).not.toBeDisabled()
    })

    it('the result panel stays visible indefinitely, unlike the toast it replaced', async () => {
        const user = userEvent.setup()
        postMock.mockResolvedValueOnce({ matchesUpdated: 4 })

        renderTab()
        await user.click(screen.getByRole('button', { name: 'Recalculate Upcoming Odds' }))
        await screen.findByRole('status')

        vi.useFakeTimers()
        vi.advanceTimersByTime(10_000) // well past the old 4s toast auto-dismiss window
        vi.useRealTimers()

        expect(screen.getByRole('status')).toHaveTextContent('Recalculated odds for 4 upcoming match(es).')
    })

    it('dismisses the result panel when its close button is clicked', async () => {
        const user = userEvent.setup()
        postMock.mockResolvedValueOnce({ matchesUpdated: 4 })

        renderTab()
        await user.click(screen.getByRole('button', { name: 'Recalculate Upcoming Odds' }))
        await screen.findByRole('status')

        await user.click(screen.getByRole('button', { name: 'dismiss' }))

        expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
})
