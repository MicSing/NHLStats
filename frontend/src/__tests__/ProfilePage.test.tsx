import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ProfilePage from '../pages/ProfilePage'
import { AuthProvider } from '../context/AuthContext'
import { ThemeProvider } from '../context/ThemeContext'
import { ToastProvider } from '../context/ToastContext'

// Mock services
vi.mock('../services/cacheService', () => ({
    cacheService: {
        getUsers: vi.fn().mockResolvedValue([
            { id: 1, name: 'Michal Hráč', isActive: true },
        ]),
        getAchievements: vi.fn().mockResolvedValue({
            achievements: [
                {
                    id: 'sniper',
                    earned: true,
                    level: 2,
                    count: 15,
                    currentLevelAt: 10,
                    nextLevelAt: 25,
                    occurrences: [
                        {
                            matchId: 101,
                            occurredOn: new Date().toISOString(), // recent (< 7 days)
                            weekNumber: 1,
                            seasonId: 1,
                            seasonName: 'Season 1',
                            rosterPlayerName: 'Player 1',
                            value: 15,
                        },
                    ],
                },
            ],
        }),
    },
}))

vi.mock('../services/bettingService', () => ({
    bettingService: {
        getBalance: vi.fn().mockResolvedValue({
            availableBalance: 125.5,
            maxWinCap: 500,
            totalPositiveCash: 200,
            totalWonProfit: 55.5,
            totalPendingStake: 20,
            totalLostStake: 30,
        }),
        listActive: vi.fn().mockResolvedValue([]),
        listHistory: vi.fn().mockResolvedValue([
            {
                id: 'bet-1',
                shortId: 'T101',
                createdBy: 'user-1',
                createdByName: 'Test User',
                stake: 10,
                totalOdds: 2.5,
                status: 'Won',
                wonAmount: 25,
                createdOn: new Date().toISOString(),
                updatedOn: null,
                evaluatedOn: new Date().toISOString(),
                legs: [
                    {
                        id: 1,
                        matchId: 101,
                        matchNumber: 1,
                        seasonId: 1,
                        homeTeamName: 'BOS',
                        awayTeamName: 'TOR',
                        betType: 'TeamWin',
                        userId: null,
                        teamId: 1,
                        targetName: 'BOS',
                        odds: 2.5,
                        occasions: 1,
                        status: 'Won',
                        evaluatedOn: new Date().toISOString(),
                    },
                ],
            },
        ]),
    },
}))

function renderProfilePage(initialTab = 'overview', authenticated = true) {
    if (authenticated) {
        localStorage.setItem('token', 'fake-jwt-token')
        localStorage.setItem(
            'user',
            JSON.stringify({
                id: 'u-1',
                email: 'user@test.com',
                alias: 'Tester',
                userId: 1,
                roles: ['Player'],
            })
        )
    } else {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
    }

    return render(
        <ThemeProvider>
            <AuthProvider>
                <ToastProvider>
                    <MemoryRouter initialEntries={[`/profile?tab=${initialTab}`]}>
                        <ProfilePage />
                    </MemoryRouter>
                </ToastProvider>
            </AuthProvider>
        </ThemeProvider>
    )
}

describe('ProfilePage', () => {
    afterEach(() => {
        localStorage.clear()
        vi.clearAllMocks()
    })

    test('renders profile header with tabs', async () => {
        renderProfilePage('overview')

        expect(screen.getByRole('heading', { level: 1 })).toBeDefined()
        expect(screen.getByText(/Tester/i)).toBeDefined()

        await waitFor(() => {
            expect(screen.getByText('Michal Hráč')).toBeDefined()
        })
    })

    test('renders recent achievements in overview tab', async () => {
        renderProfilePage('overview')

        await waitFor(() => {
            // "Marksman" is level 2 name for sniper
            expect(screen.getByText('Marksman')).toBeDefined()
        })
    })

    test('switches to bets tab and shows betting history', async () => {
        renderProfilePage('bets')

        await waitFor(() => {
            expect(screen.getByText('#T101')).toBeDefined()
            expect(screen.getByText('×2.50')).toBeDefined()
        })
    })

    test('switches to settings tab and shows theme, language, and password form', async () => {
        renderProfilePage('settings')

        await waitFor(() => {
            expect(screen.getByText('Slovenčina')).toBeDefined()
            expect(screen.getByText('English')).toBeDefined()
            expect(screen.getAllByPlaceholderText('••••••••').length).toBeGreaterThanOrEqual(1)
        })
    })

    test('switches to achievements tab and lists all badges', async () => {
        renderProfilePage('achievements')

        await waitFor(() => {
            expect(screen.getByPlaceholderText(/Hľadať|Search/i)).toBeDefined()
        })
    })

    test('unauthenticated guest sees only settings tab with theme and language, without password form', async () => {
        renderProfilePage('overview', false)

        await waitFor(() => {
            expect(screen.getByText('Slovenčina')).toBeDefined()
            expect(screen.getByText('English')).toBeDefined()
        })

        // Password form should not be present
        expect(screen.queryByPlaceholderText('••••••••')).toBeNull()
        // No overview tab
        expect(screen.queryByText('Michal Hráč')).toBeNull()
    })
})
