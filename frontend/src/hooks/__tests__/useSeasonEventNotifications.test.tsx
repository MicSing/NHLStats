import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AuthProvider } from '../../context/AuthContext'

type Handler = (evt: Record<string, unknown>) => void

const handlers = new Set<Handler>()
const invokeCalls: Array<{ method: string; args: unknown[] }> = []

vi.mock('../../services/seasonEventsHub', () => ({
    getSeasonEventsConnection: vi.fn(async () => ({
        on: (event: string, handler: Handler) => {
            if (event === 'SeasonEvent') handlers.add(handler)
        },
        off: (event: string, handler: Handler) => {
            if (event === 'SeasonEvent') handlers.delete(handler)
        },
        invoke: vi.fn(async (method: string, ...args: unknown[]) => {
            invokeCalls.push({ method, args })
        }),
    })),
    resetSeasonEventsConnection: vi.fn(),
}))

import { useSeasonEventNotifications } from '../useSeasonEventNotifications'

const NotificationCtor = vi.fn()
class FakeNotification {
    static permission: NotificationPermission = 'granted'
    static requestPermission = vi.fn(async () => FakeNotification.permission)
    constructor(title: string, opts?: NotificationOptions) {
        NotificationCtor(title, opts)
    }
}

function wrapper({ children }: { children: ReactNode }) {
    return <AuthProvider>{children}</AuthProvider>
}

function emit(evt: Record<string, unknown>) {
    for (const h of handlers) h(evt)
}

const SELF_USER_ID = 'self-user-id'

describe('useSeasonEventNotifications', () => {
    beforeEach(() => {
        handlers.clear()
        invokeCalls.length = 0
        NotificationCtor.mockReset()
        ;(globalThis as unknown as { Notification: typeof FakeNotification }).Notification = FakeNotification
        FakeNotification.permission = 'granted'
        localStorage.setItem('token', 'fake-jwt')
        localStorage.setItem('user', JSON.stringify({ id: SELF_USER_ID, email: 's@x.test', userId: 1, roles: ['Admin'] }))
    })

    afterEach(() => {
        localStorage.clear()
    })

    test('joins season group on mount and leaves on unmount', async () => {
        const { unmount } = renderHook(() => useSeasonEventNotifications(42), { wrapper })

        await waitFor(() => {
            expect(invokeCalls.some(c => c.method === 'JoinSeason' && c.args[0] === 42)).toBe(true)
        })

        unmount()

        await waitFor(() => {
            expect(invokeCalls.some(c => c.method === 'LeaveSeason' && c.args[0] === 42)).toBe(true)
        })
    })

    test('shows native notification for events from another user', async () => {
        renderHook(() => useSeasonEventNotifications(42), { wrapper })

        await waitFor(() => {
            expect(invokeCalls.some(c => c.method === 'JoinSeason')).toBe(true)
        })

        act(() => {
            emit({
                seasonId: 42,
                matchId: 1,
                userMatchId: 2,
                actorUserId: 'other-user',
                actorUserName: 'Bob',
                eventType: 'Goal',
                eventSubType: 'Regular',
                playerName: 'McDavid',
                count: 1,
                targetUserName: 'Alice',
                homeTeamName: null,
                awayTeamName: null,
                homeScore: null,
                awayScore: null,
            })
        })

        expect(NotificationCtor).toHaveBeenCalledTimes(1)
        const [title, opts] = NotificationCtor.mock.calls[0]
        expect(title).toMatch(/goal/i)
        expect((opts as NotificationOptions).body).toContain('Alice')
        expect((opts as NotificationOptions).body).toContain('McDavid')
    })

    test('suppresses notification when actor is current user', async () => {
        renderHook(() => useSeasonEventNotifications(42), { wrapper })

        await waitFor(() => {
            expect(invokeCalls.some(c => c.method === 'JoinSeason')).toBe(true)
        })

        act(() => {
            emit({
                seasonId: 42,
                matchId: 1,
                userMatchId: 2,
                actorUserId: SELF_USER_ID,
                actorUserName: 'Me',
                eventType: 'Penalty',
                eventSubType: 'Standard',
                playerName: 'Crosby',
                count: 1,
                targetUserName: 'Alice',
                homeTeamName: null,
                awayTeamName: null,
                homeScore: null,
                awayScore: null,
            })
        })

        expect(NotificationCtor).not.toHaveBeenCalled()
    })

    test('no notification when permission denied', async () => {
        FakeNotification.permission = 'denied'
        renderHook(() => useSeasonEventNotifications(42), { wrapper })

        await waitFor(() => {
            expect(invokeCalls.some(c => c.method === 'JoinSeason')).toBe(true)
        })

        act(() => {
            emit({
                seasonId: 42,
                matchId: 1,
                userMatchId: 2,
                actorUserId: 'other',
                actorUserName: 'Bob',
                eventType: 'Point',
                eventSubType: 'Positive',
                playerName: null,
                count: 1,
                targetUserName: null,
                homeTeamName: null,
                awayTeamName: null,
                homeScore: null,
                awayScore: null,
            })
        })

        expect(NotificationCtor).not.toHaveBeenCalled()
    })

    test('ignores events for a different season', async () => {
        renderHook(() => useSeasonEventNotifications(42), { wrapper })

        await waitFor(() => {
            expect(invokeCalls.some(c => c.method === 'JoinSeason')).toBe(true)
        })

        act(() => {
            emit({
                seasonId: 99,
                matchId: 1,
                userMatchId: 2,
                actorUserId: 'other',
                actorUserName: 'Bob',
                eventType: 'Goal',
                eventSubType: 'Regular',
                playerName: null,
                count: 1,
                targetUserName: null,
                homeTeamName: null,
                awayTeamName: null,
                homeScore: null,
                awayScore: null,
            })
        })

        expect(NotificationCtor).not.toHaveBeenCalled()
    })

    test('shows match completed notification with score', async () => {
        renderHook(() => useSeasonEventNotifications(42), { wrapper })

        await waitFor(() => {
            expect(invokeCalls.some(c => c.method === 'JoinSeason')).toBe(true)
        })

        act(() => {
            emit({
                seasonId: 42,
                matchId: 5,
                userMatchId: 0,
                actorUserId: null,
                actorUserName: null,
                eventType: 'MatchCompleted',
                eventSubType: 'RegularTime',
                playerName: null,
                count: 0,
                targetUserName: null,
                homeTeamName: 'TeamA',
                awayTeamName: 'TeamB',
                homeScore: 3,
                awayScore: 0,
            })
        })

        expect(NotificationCtor).toHaveBeenCalledTimes(1)
        const [title, opts] = NotificationCtor.mock.calls[0]
        expect(title).toMatch(/match completed/i)
        expect((opts as NotificationOptions).body).toBe('TeamA 3:0 TeamB')
    })
})
