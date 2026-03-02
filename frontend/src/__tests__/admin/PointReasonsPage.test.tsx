import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../testUtils'
import PointReasonsPage from '../../pages/admin/PointReasonsPage'

describe('PointReasonsPage', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    test('renders reasons list from API', async () => {
        renderWithProviders(<PointReasonsPage />)
        expect(await screen.findByText('Penalty')).toBeInTheDocument()
        expect(screen.getByText('Scoring 10 Goals')).toBeInTheDocument()
    })

    test('shows Negative badge for negative reason and Positive badge for positive reason', async () => {
        renderWithProviders(<PointReasonsPage />)
        await screen.findByText('Penalty')
        expect(screen.getByText('Negative')).toBeInTheDocument()
        expect(screen.getByText('Positive')).toBeInTheDocument()
    })

    test('shows Active badges', async () => {
        renderWithProviders(<PointReasonsPage />)
        await screen.findByText('Penalty')
        const activeBadges = screen.getAllByText('Active')
        expect(activeBadges.length).toBeGreaterThan(0)
    })

    test('shows Deactivate buttons for active reasons', async () => {
        renderWithProviders(<PointReasonsPage />)
        await screen.findByText('Penalty')
        const deactivateBtns = screen.getAllByRole('button', { name: /deactivate/i })
        expect(deactivateBtns.length).toBeGreaterThan(0)
    })

    test('shows Add Reason button', async () => {
        renderWithProviders(<PointReasonsPage />)
        expect(await screen.findByRole('button', { name: /add reason/i })).toBeInTheDocument()
    })

    test('opens add modal with name input and type radios', async () => {
        const user = userEvent.setup()
        renderWithProviders(<PointReasonsPage />)
        await user.click(await screen.findByRole('button', { name: /add reason/i }))
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument()
        expect(screen.getByRole('radio', { name: /negative/i })).toBeInTheDocument()
        expect(screen.getByRole('radio', { name: /positive/i })).toBeInTheDocument()
    })

    test('add form submits and closes modal', async () => {
        const user = userEvent.setup()
        renderWithProviders(<PointReasonsPage />)
        await user.click(await screen.findByRole('button', { name: /add reason/i }))
        await user.type(screen.getByLabelText(/^name$/i), 'Own Goal')
        await user.click(screen.getByRole('button', { name: /^save$/i }))
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        })
    })

    test('edit button opens modal pre-populated with reason data', async () => {
        const user = userEvent.setup()
        renderWithProviders(<PointReasonsPage />)
        const editButtons = await screen.findAllByRole('button', { name: /^edit$/i })
        await user.click(editButtons[0])
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByDisplayValue('Penalty')).toBeInTheDocument()
    })

    test('edit form saves and closes modal', async () => {
        const user = userEvent.setup()
        renderWithProviders(<PointReasonsPage />)
        const editButtons = await screen.findAllByRole('button', { name: /^edit$/i })
        await user.click(editButtons[0])
        const nameInput = screen.getByDisplayValue('Penalty')
        await user.clear(nameInput)
        await user.type(nameInput, 'Updated Reason')
        await user.click(screen.getByRole('button', { name: /^save$/i }))
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        })
    })

    test('deactivate button calls API and refreshes list', async () => {
        const user = userEvent.setup()
        renderWithProviders(<PointReasonsPage />)
        const btn = await screen.findAllByRole('button', { name: /deactivate/i })
        await user.click(btn[0])
        // List refreshes without error
        await screen.findByText('Penalty')
    })
})
