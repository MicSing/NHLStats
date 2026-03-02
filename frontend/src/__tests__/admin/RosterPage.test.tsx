import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../testUtils'
import RosterPage from '../../pages/admin/RosterPage'

describe('RosterPage', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    test('renders season selector', async () => {
        renderWithProviders(<RosterPage />)
        expect(await screen.findByLabelText(/season/i)).toBeInTheDocument()
    })

    test('shows prompt to select a season when none selected', async () => {
        renderWithProviders(<RosterPage />)
        expect(await screen.findByText(/select a season to manage/i)).toBeInTheDocument()
    })

    test('loads seasons into the dropdown', async () => {
        renderWithProviders(<RosterPage />)
        const select = await screen.findByLabelText(/season/i)
        expect(select).toBeInTheDocument()
        // "2023-24" should appear as an option
        expect(screen.getByRole('option', { name: /2023-24/i })).toBeInTheDocument()
    })

    test('shows roster after selecting a season', async () => {
        const user = userEvent.setup()
        renderWithProviders(<RosterPage />)
        const select = await screen.findByLabelText(/season/i)
        await user.selectOptions(select, '1')
        expect(await screen.findByText(/Connor/i)).toBeInTheDocument()
        expect(screen.getByText(/McDavid/i)).toBeInTheDocument()
    })

    test('shows Add Player, Import CSV, and Copy from Season buttons after season selected', async () => {
        const user = userEvent.setup()
        renderWithProviders(<RosterPage />)
        const select = await screen.findByLabelText(/season/i)
        await user.selectOptions(select, '1')
        expect(await screen.findByRole('button', { name: /add player/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /import csv/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /copy from season/i })).toBeInTheDocument()
    })

    test('Import CSV button opens modal with CSV textarea', async () => {
        const user = userEvent.setup()
        renderWithProviders(<RosterPage />)
        const select = await screen.findByLabelText(/season/i)
        await user.selectOptions(select, '1')
        await user.click(await screen.findByRole('button', { name: /import csv/i }))
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByLabelText(/csv content/i)).toBeInTheDocument()
    })

    test('CSV import submits and shows success message', async () => {
        const user = userEvent.setup()
        renderWithProviders(<RosterPage />)
        const select = await screen.findByLabelText(/season/i)
        await user.selectOptions(select, '1')
        await user.click(await screen.findByRole('button', { name: /import csv/i }))
        await user.type(screen.getByLabelText(/csv content/i), 'John,Doe,C,BOS')
        await user.click(screen.getByRole('button', { name: /^import$/i }))
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        })
        expect(await screen.findByText(/imported 2 player/i)).toBeInTheDocument()
    })

    test('Copy from Season button opens modal with source season dropdown', async () => {
        const user = userEvent.setup()
        renderWithProviders(<RosterPage />)
        const select = await screen.findByLabelText(/season/i)
        await user.selectOptions(select, '1')
        await user.click(await screen.findByRole('button', { name: /copy from season/i }))
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByLabelText(/source season/i)).toBeInTheDocument()
    })
})
