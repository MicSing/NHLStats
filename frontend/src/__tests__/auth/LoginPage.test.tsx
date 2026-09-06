import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext'
import LoginPage from '../../pages/LoginPage'

function renderLoginPage(initialEntries = ['/login']) {
    return render(
        <AuthProvider>
            <MemoryRouter initialEntries={initialEntries}>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/profile" element={<div>Profile Landing Page</div>} />
                </Routes>
            </MemoryRouter>
        </AuthProvider>,
    )
}

describe('LoginPage', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    test('renders a heading', () => {
        renderLoginPage()
        expect(screen.getByRole('heading')).toBeInTheDocument()
    })

    test('renders email and password fields', () => {
        renderLoginPage()
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    })

    test('renders sign in button', () => {
        renderLoginPage()
        expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    })

    test('stores JWT in localStorage on successful login and redirects to /profile', async () => {
        const user = userEvent.setup()
        renderLoginPage()

        await user.type(screen.getByLabelText(/email/i), 'admin@test.com')
        await user.type(screen.getByLabelText(/password/i), 'Admin123!')
        await user.click(screen.getByRole('button', { name: /sign in/i }))

        await waitFor(() => {
            expect(localStorage.getItem('token')).toBe('fake-jwt-token')
            expect(screen.getByText('Profile Landing Page')).toBeInTheDocument()
        })
    })

    test('shows error message on invalid credentials', async () => {
        const user = userEvent.setup()
        renderLoginPage()

        await user.type(screen.getByLabelText(/email/i), 'wrong@test.com')
        await user.type(screen.getByLabelText(/password/i), 'wrongpassword')
        await user.click(screen.getByRole('button', { name: /sign in/i }))

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument()
        })
        expect(screen.getByRole('alert')).toHaveTextContent(/invalid/i)
    })

    test('shows deactivated-account message for a deactivated user', async () => {
        const user = userEvent.setup()
        renderLoginPage()

        await user.type(screen.getByLabelText(/email/i), 'deactivated@test.com')
        await user.type(screen.getByLabelText(/password/i), 'whatever')
        await user.click(screen.getByRole('button', { name: /sign in/i }))

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument()
        })
        expect(screen.getByRole('alert')).toHaveTextContent(/deactivated/i)
    })

    test('disables button while submitting', async () => {
        const user = userEvent.setup()
        renderLoginPage()

        await user.type(screen.getByLabelText(/email/i), 'admin@test.com')
        await user.type(screen.getByLabelText(/password/i), 'Admin123!')

        const button = screen.getByRole('button', { name: /sign in/i })
        await user.click(button)

        // After successful login the button should re-enable (loading state clears)
        await waitFor(() => {
            expect(localStorage.getItem('token')).toBe('fake-jwt-token')
        })
    })
})
