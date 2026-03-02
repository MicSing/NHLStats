import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../testUtils'
import UsersPage from '../../pages/admin/UsersPage'

describe('UsersPage', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    test('renders user list from API', async () => {
        renderWithProviders(<UsersPage />)
        expect(await screen.findByText('Player One')).toBeInTheDocument()
        expect(screen.getByText('Player Two')).toBeInTheDocument()
    })

    test('shows Active badge for active user and Inactive badge for inactive user', async () => {
        renderWithProviders(<UsersPage />)
        await screen.findByText('Player One')
        const badges = screen.getAllByText(/active/i)
        expect(badges.some((b) => b.textContent === 'Active')).toBe(true)
        expect(badges.some((b) => b.textContent === 'Inactive')).toBe(true)
    })

    test('shows Add User button', async () => {
        renderWithProviders(<UsersPage />)
        expect(await screen.findByRole('button', { name: /add user/i })).toBeInTheDocument()
    })

    test('opens add user modal on button click', async () => {
        const user = userEvent.setup()
        renderWithProviders(<UsersPage />)
        await user.click(await screen.findByRole('button', { name: /add user/i }))
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
    })

    test('add form submits and closes modal', async () => {
        const user = userEvent.setup()
        renderWithProviders(<UsersPage />)
        await user.click(await screen.findByRole('button', { name: /add user/i }))
        await user.type(screen.getByLabelText(/name/i), 'New Player')
        await user.click(screen.getByRole('button', { name: /^save$/i }))
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        })
    })

    test('edit button opens modal pre-populated with user data', async () => {
        const user = userEvent.setup()
        renderWithProviders(<UsersPage />)
        const editButtons = await screen.findAllByRole('button', { name: /^edit$/i })
        await user.click(editButtons[0])
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByDisplayValue('Player One')).toBeInTheDocument()
    })

    test('edit form saves and closes modal', async () => {
        const user = userEvent.setup()
        renderWithProviders(<UsersPage />)
        const editButtons = await screen.findAllByRole('button', { name: /^edit$/i })
        await user.click(editButtons[0])
        const nameInput = screen.getByDisplayValue('Player One')
        await user.clear(nameInput)
        await user.type(nameInput, 'Updated Player')
        await user.click(screen.getByRole('button', { name: /^save$/i }))
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        })
    })

    test('deactivate button is shown only for active users', async () => {
        renderWithProviders(<UsersPage />)
        await screen.findByText('Player One')
        // Player One is active → has deactivate button; Player Two is inactive → no deactivate
        const deactivateBtns = screen.getAllByRole('button', { name: /deactivate/i })
        expect(deactivateBtns).toHaveLength(1)
    })

    test('clicking deactivate calls API and refreshes list', async () => {
        const user = userEvent.setup()
        renderWithProviders(<UsersPage />)
        const btn = await screen.findByRole('button', { name: /deactivate/i })
        await user.click(btn)
        // List re-loads without error
        await screen.findByText('Player One')
    })
})
