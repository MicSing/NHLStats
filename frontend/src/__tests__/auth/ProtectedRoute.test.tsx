import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext'
import ProtectedRoute from '../../components/ProtectedRoute'

function renderProtectedRoute() {
    return render(
        <AuthProvider>
            <MemoryRouter initialEntries={['/protected']}>
                <Routes>
                    <Route path="/login" element={<div>Login Page</div>} />
                    <Route
                        path="/protected"
                        element={
                            <ProtectedRoute>
                                <div>Protected Content</div>
                            </ProtectedRoute>
                        }
                    />
                </Routes>
            </MemoryRouter>
        </AuthProvider>,
    )
}

describe('ProtectedRoute', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    test('redirects to /login when not authenticated', () => {
        renderProtectedRoute()
        expect(screen.getByText('Login Page')).toBeInTheDocument()
        expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    })

    test('renders children when authenticated', () => {
        localStorage.setItem('token', 'valid-token')
        localStorage.setItem('user', JSON.stringify({ id: 'user-1', email: 'admin@test.com' }))
        renderProtectedRoute()
        expect(screen.getByText('Protected Content')).toBeInTheDocument()
        expect(screen.queryByText('Login Page')).not.toBeInTheDocument()
    })
})
