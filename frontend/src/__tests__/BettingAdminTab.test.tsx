import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BettingAdminTab from '../components/finance/BettingAdminTab'
import { ToastProvider } from '../context/ToastContext'

const postMock = vi.fn()
vi.mock('../services/apiClient', () => ({
    default: {
        post: (...args: unknown[]) => postMock(...args),
    },
}))

function renderTab() {
    return render(
        <ToastProvider>
            <BettingAdminTab />
        </ToastProvider>,
    )
}

describe('BettingAdminTab', () => {
    beforeEach(() => {
        postMock.mockReset()
    })

    it('recalculates upcoming match odds without a confirmation prompt', async () => {
        const user = userEvent.setup()
        const confirmSpy = vi.spyOn(window, 'confirm')
        postMock.mockResolvedValueOnce({ matchesUpdated: 4 })

        renderTab()
        await user.click(screen.getByRole('button', { name: 'Recalculate Upcoming Odds' }))

        expect(confirmSpy).not.toHaveBeenCalled()
        expect(postMock).toHaveBeenCalledWith('/api/admin/odds/recalculate-upcoming', {})
        expect(await screen.findByRole('alert')).toHaveTextContent('Recalculated odds for 4 upcoming match(es).')
    })

    it('does not call the API when the historical-odds confirmation is dismissed', async () => {
        const user = userEvent.setup()
        vi.spyOn(window, 'confirm').mockReturnValue(false)

        renderTab()
        await user.click(screen.getByRole('button', { name: 'Recalculate Historical Odds' }))

        expect(postMock).not.toHaveBeenCalled()
    })

    it('recalculates historical ticket odds once the confirmation is accepted', async () => {
        const user = userEvent.setup()
        vi.spyOn(window, 'confirm').mockReturnValue(true)
        postMock.mockResolvedValueOnce({ betsUpdated: 7 })

        renderTab()
        await user.click(screen.getByRole('button', { name: 'Recalculate Historical Odds' }))

        expect(postMock).toHaveBeenCalledWith('/api/admin/bets/recalculate-historical-odds', {})
        expect(await screen.findByRole('alert')).toHaveTextContent('Recalculated 7 historical ticket(s).')
    })

    it('shows an error toast when the historical recalculation fails', async () => {
        const user = userEvent.setup()
        vi.spyOn(window, 'confirm').mockReturnValue(true)
        postMock.mockRejectedValueOnce(new Error('boom'))

        renderTab()
        await user.click(screen.getByRole('button', { name: 'Recalculate Historical Odds' }))

        expect(await screen.findByRole('alert')).toHaveTextContent('Failed to recalculate historical odds. Please try again.')
    })

    it('disables all recalculation buttons while one is running', async () => {
        const user = userEvent.setup()
        let resolvePost: (value: { matchesUpdated: number }) => void = () => { }
        postMock.mockReturnValueOnce(new Promise((resolve) => { resolvePost = resolve }))

        renderTab()
        await user.click(screen.getByRole('button', { name: 'Recalculate Upcoming Odds' }))

        expect(screen.getByRole('button', { name: 'Recalculate Historical Odds' })).toBeDisabled()

        resolvePost({ matchesUpdated: 0 })
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Recalculate Historical Odds' })).not.toBeDisabled()
        })
    })
})
