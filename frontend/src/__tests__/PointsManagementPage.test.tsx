import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext'
import { ThemeProvider } from '../context/ThemeContext'
import { ToastProvider } from '../context/ToastContext'
import PointsManagementPage from '../pages/admin/PointsManagementPage'

function renderPage() {
    return render(
        <ThemeProvider>
            <AuthProvider>
                <ToastProvider>
                    <MemoryRouter initialEntries={['/admin/points']}>
                        <Routes>
                            <Route path="/admin/points" element={<PointsManagementPage />} />
                        </Routes>
                    </MemoryRouter>
                </ToastProvider>
            </AuthProvider>
        </ThemeProvider>,
    )
}

describe('PointsManagementPage filters', () => {
    it('renders Season dropdown populated from /api/seasons', async () => {
        renderPage()
        await waitFor(() => {
            expect(screen.getByRole('combobox', { name: /season/i })).toBeInTheDocument()
        })
        expect(screen.getByRole('option', { name: '2023-24' })).toBeInTheDocument()
        expect(screen.getByRole('option', { name: '2024-25' })).toBeInTheDocument()
    })

    it('renders Player dropdown populated from /api/users', async () => {
        renderPage()
        await waitFor(() => {
            expect(screen.getByRole('combobox', { name: /player/i })).toBeInTheDocument()
        })
        expect(screen.getByRole('option', { name: 'Player One' })).toBeInTheDocument()
        expect(screen.getByRole('option', { name: 'Player Two' })).toBeInTheDocument()
    })

    it('shows a totals row with summed count and amount', async () => {
        renderPage()
        // mock data: count 2 + 1 = 3, amount 1.5 + (-0.5) = 1.0
        await waitFor(() => {
            expect(screen.getByText('3')).toBeInTheDocument()
        })
        expect(screen.getByText('1.00 €')).toBeInTheDocument()
    })

    it('renders points table with rows for each point entry', async () => {
        renderPage()
        await waitFor(() => {
            expect(screen.getAllByText('Player One').length).toBeGreaterThanOrEqual(1)
        })
        expect(screen.getAllByText('Player Two').length).toBeGreaterThanOrEqual(1)
        expect(screen.getByText('Penalty')).toBeInTheDocument()
        expect(screen.getByText('Own Goal')).toBeInTheDocument()
    })
})
