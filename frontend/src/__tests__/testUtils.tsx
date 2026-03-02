import { render } from '@testing-library/react'
import type { RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext'

export function renderWithProviders(
    ui: ReactElement,
    { route = '/' }: { route?: string } = {},
): RenderResult {
    localStorage.setItem('token', 'fake-jwt-token')
    localStorage.setItem('user', JSON.stringify({ id: '1', email: 'admin@test.com' }))
    return render(
        <AuthProvider>
            <MemoryRouter initialEntries={[route]}>
                {ui}
            </MemoryRouter>
        </AuthProvider>,
    )
}

export function renderWithoutAuth(
    ui: ReactElement,
    { route = '/' }: { route?: string } = {},
): RenderResult {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    return render(
        <AuthProvider>
            <MemoryRouter initialEntries={[route]}>
                {ui}
            </MemoryRouter>
        </AuthProvider>,
    )
}
