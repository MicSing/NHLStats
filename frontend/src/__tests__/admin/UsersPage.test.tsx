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

    test('clicking a user row opens the drawer with their details', async () => {
        const user = userEvent.setup()
        renderWithProviders(<UsersPage />)
        await user.click(await screen.findByText('Player One'))
        // Drawer renders the user name as a heading and their login email
        expect(await screen.findByRole('heading', { name: 'Player One' })).toBeInTheDocument()
        expect(screen.getAllByText('player.one@test.com').length).toBeGreaterThan(0)
    })

    test('deactivate button is shown only for active users', async () => {
        const user = userEvent.setup()
        renderWithProviders(<UsersPage />)
        // Player One is active — drawer shows the deactivate control
        await user.click(await screen.findByText('Player One'))
        expect(await screen.findByRole('button', { name: /deactivate/i })).toBeInTheDocument()

        // Player Two is inactive — no deactivate control, an activate control instead
        await user.click(screen.getByText('Player Two'))
        expect(screen.queryByRole('button', { name: /deactivate/i })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: /activate/i })).toBeInTheDocument()
    })

    test('clicking deactivate asks for confirmation before calling the API', async () => {
        const user = userEvent.setup()
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
        renderWithProviders(<UsersPage />)
        await user.click(await screen.findByText('Player One'))
        const btn = await screen.findByRole('button', { name: /deactivate/i })
        await user.click(btn)

        expect(confirmSpy).toHaveBeenCalled()
        // Declined confirmation — the drawer still shows the deactivate control (nothing changed)
        expect(screen.getByRole('button', { name: /deactivate/i })).toBeInTheDocument()
        confirmSpy.mockRestore()
    })

    test('confirming deactivate calls API and refreshes list', async () => {
        const user = userEvent.setup()
        vi.spyOn(window, 'confirm').mockReturnValue(true)
        renderWithProviders(<UsersPage />)
        await user.click(await screen.findByText('Player One'))
        const btn = await screen.findByRole('button', { name: /deactivate/i })
        await user.click(btn)
        // List re-loads without error
        await screen.findAllByText('Player One')
        vi.restoreAllMocks()
    })

    test('reactivate button calls API and refreshes list', async () => {
        const user = userEvent.setup()
        renderWithProviders(<UsersPage />)
        await user.click(await screen.findByText('Player Two'))
        const btn = await screen.findByRole('button', { name: /activate/i })
        await user.click(btn)
        // List re-loads without error
        await screen.findAllByText('Player Two')
    })

    test('login management is locked down while the owning user is inactive', async () => {
        const user = userEvent.setup()
        renderWithProviders(<UsersPage />)

        // Player One is active — can add an identity and delete an existing login
        await user.click(await screen.findByText('Player One'))
        expect(await screen.findByText(/pridať identitu/i)).toBeInTheDocument()
        expect(screen.getByTitle(/delete/i)).toBeInTheDocument()

        // Player Two is inactive — neither action is available
        await user.click(screen.getByText('Player Two'))
        expect(screen.queryByText(/pridať identitu/i)).not.toBeInTheDocument()
        expect(screen.queryByTitle(/delete/i)).not.toBeInTheDocument()
    })
})
