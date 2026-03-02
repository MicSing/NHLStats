import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../testUtils'
import SeasonsPage from '../../pages/admin/SeasonsPage'

describe('SeasonsPage', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    test('renders season list from API', async () => {
        renderWithProviders(<SeasonsPage />)
        expect(await screen.findByText('2023-24')).toBeInTheDocument()
    })

    test('shows hosted team name in the row', async () => {
        renderWithProviders(<SeasonsPage />)
        expect(await screen.findByText('Boston Bruins')).toBeInTheDocument()
    })

    test('shows Add Season button', async () => {
        renderWithProviders(<SeasonsPage />)
        expect(await screen.findByRole('button', { name: /add season/i })).toBeInTheDocument()
    })

    test('opens add season modal with team dropdown', async () => {
        const user = userEvent.setup()
        renderWithProviders(<SeasonsPage />)
        await user.click(await screen.findByRole('button', { name: /add season/i }))
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
        // Teams loaded into the Hosted By dropdown
        const select = screen.getByLabelText(/hosted by/i)
        expect(within(select).getByText('Boston Bruins')).toBeInTheDocument()
    })

    test('create form submits and closes modal', async () => {
        const user = userEvent.setup()
        renderWithProviders(<SeasonsPage />)
        await user.click(await screen.findByRole('button', { name: /add season/i }))
        await user.type(screen.getByLabelText(/^name$/i), 'New Season')
        await user.click(screen.getByRole('button', { name: /^save$/i }))
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        })
    })

    test('edit button opens form pre-populated with season data', async () => {
        const user = userEvent.setup()
        renderWithProviders(<SeasonsPage />)
        const editButtons = await screen.findAllByRole('button', { name: /^edit$/i })
        await user.click(editButtons[0])
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByDisplayValue('2023-24')).toBeInTheDocument()
    })

    test('edit form saves and closes modal', async () => {
        const user = userEvent.setup()
        renderWithProviders(<SeasonsPage />)
        const editButtons = await screen.findAllByRole('button', { name: /^edit$/i })
        await user.click(editButtons[0])
        const nameInput = screen.getByDisplayValue('2023-24')
        await user.clear(nameInput)
        await user.type(nameInput, 'Updated Season')
        await user.click(screen.getByRole('button', { name: /^save$/i }))
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        })
    })

    test('Users button opens season users modal', async () => {
        const user = userEvent.setup()
        renderWithProviders(<SeasonsPage />)
        const userButtons = await screen.findAllByRole('button', { name: /^users$/i })
        await user.click(userButtons[0])
        expect(await screen.findByText('Player One')).toBeInTheDocument()
        expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    test('assign users dropdown lists unassigned users', async () => {
        const user = userEvent.setup()
        renderWithProviders(<SeasonsPage />)
        const userButtons = await screen.findAllByRole('button', { name: /^users$/i })
        await user.click(userButtons[0])
        // Player One is already assigned; Player Two is inactive but still in allUsers
        const select = await screen.findByRole('combobox', { name: /select user/i })
        // Player Two should be available since not already in season
        expect(within(select).getByText('Player Two')).toBeInTheDocument()
    })
})
