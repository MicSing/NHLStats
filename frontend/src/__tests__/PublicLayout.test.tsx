import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PublicLayout from '../components/PublicLayout'
import { AuthProvider } from '../context/AuthContext'
import { ThemeProvider } from '../context/ThemeContext'
import { ToastProvider } from '../context/ToastContext'
import { cacheService } from '../services/cacheService'

vi.mock('../services/cacheService', () => ({
    cacheService: {
        getAchievements: vi.fn(),
    },
}))

function renderLayout(isAuthenticated = true, user = { id: 'u-1', email: 'test@example.com', alias: 'Tester', userId: 1, roles: ['Player'] }) {
    if (isAuthenticated) {
        localStorage.setItem('token', 'fake-jwt-token')
        localStorage.setItem('user', JSON.stringify(user))
    } else {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
    }

    return render(
        <ThemeProvider>
            <AuthProvider>
                <ToastProvider>
                    <MemoryRouter>
                        <PublicLayout />
                    </MemoryRouter>
                </ToastProvider>
            </AuthProvider>
        </ThemeProvider>
    )
}

describe('PublicLayout navigation and user menu', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
        vi.mocked(cacheService.getAchievements).mockResolvedValue({ achievements: [] })
    })

    test('when unauthenticated, shows sign in and guest settings link to /profile', () => {
        renderLayout(false)

        expect(screen.getAllByRole('link', { name: /prihlásiť|sign in/i }).length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByRole('link', { name: /nastavenia|settings/i }).length).toBeGreaterThanOrEqual(1)
        // Should not render logged in user alias
        expect(screen.queryByText('Tester')).toBeNull()
    })

    test('when authenticated, shows user profile link and logout button, but NO extra settings button or sidebar theme/lang switcher', async () => {
        renderLayout(true)

        await waitFor(() => {
            expect(screen.getByText('Tester')).toBeDefined()
        })

        // Logout button is present
        expect(screen.getByLabelText(/odhlásiť|logout/i)).toBeDefined()

        // Profile link points to /profile
        const profileLink = screen.getByText('Tester').closest('a')
        expect(profileLink?.getAttribute('href')).toBe('/profile')
    })

    test('when user has a new achievement, marks navigation element with achievement icon', async () => {
        vi.mocked(cacheService.getAchievements).mockResolvedValue({
            achievements: [
                {
                    id: 'sniper',
                    earned: true,
                    level: 1,
                    count: 10,
                    currentLevelAt: 10,
                    nextLevelAt: 25,
                    occurrences: [
                        {
                            matchId: 1,
                            occurredOn: new Date().toISOString(),
                            weekNumber: 1,
                            seasonId: 1,
                            seasonName: 'S1',
                            rosterPlayerName: 'Player',
                            value: 10,
                        },
                    ],
                },
            ],
        })

        renderLayout(true)

        await waitFor(() => {
            expect(screen.getByTestId('achievement-badge')).toBeDefined()
            expect(screen.getByTestId('achievement-nav-icon')).toBeDefined()
        })

        // When user has a new achievement, profile link directs to /profile?tab=achievements
        const profileLink = screen.getByText('Tester').closest('a')
        expect(profileLink?.getAttribute('href')).toBe('/profile?tab=achievements')

        // Dispatching achievements-viewed event clears the badge
        act(() => {
            window.dispatchEvent(new Event('achievements-viewed'))
        })

        await waitFor(() => {
            expect(screen.queryByTestId('achievement-badge')).toBeNull()
            expect(screen.queryByTestId('achievement-nav-icon')).toBeNull()
        })
    })
})
