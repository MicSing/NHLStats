import { renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AuthProvider, useAuth } from '../../context/AuthContext'

const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
)

describe('AuthContext', () => {
    beforeEach(async () => {
        // Flush any pending React work from previous async tests (React 18 concurrent mode)
        await act(async () => { })
        localStorage.clear()
    })

    test('provides user as null initially', () => {
        const { result } = renderHook(() => useAuth(), { wrapper })
        expect(result.current.user).toBeNull()
    })

    test('provides token as null initially', () => {
        const { result } = renderHook(() => useAuth(), { wrapper })
        expect(result.current.token).toBeNull()
    })

    test('isAuthenticated is false initially', () => {
        const { result } = renderHook(() => useAuth(), { wrapper })
        expect(result.current.isAuthenticated).toBe(false)
    })

    test('provides login and logout functions', () => {
        const { result } = renderHook(() => useAuth(), { wrapper })
        expect(typeof result.current.login).toBe('function')
        expect(typeof result.current.logout).toBe('function')
    })

    test('login stores user and token', async () => {
        const { result } = renderHook(() => useAuth(), { wrapper })
        await act(async () => {
            await result.current.login({ email: 'admin@test.com', password: 'Admin123!' })
        })
        expect(result.current.token).toBe('fake-jwt-token')
        expect(result.current.user).toEqual({ id: 'user-1', email: 'admin@test.com' })
        expect(result.current.isAuthenticated).toBe(true)
    })

    test('login persists token and user to localStorage', async () => {
        const { result } = renderHook(() => useAuth(), { wrapper })
        await act(async () => {
            await result.current.login({ email: 'admin@test.com', password: 'Admin123!' })
        })
        expect(localStorage.getItem('token')).toBe('fake-jwt-token')
        expect(JSON.parse(localStorage.getItem('user') ?? '{}')).toEqual({
            id: 'user-1',
            email: 'admin@test.com',
        })
    })

    test('logout clears user and token', async () => {
        const { result } = renderHook(() => useAuth(), { wrapper })
        await act(async () => {
            await result.current.login({ email: 'admin@test.com', password: 'Admin123!' })
        })
        act(() => {
            result.current.logout()
        })
        expect(result.current.user).toBeNull()
        expect(result.current.token).toBeNull()
        expect(result.current.isAuthenticated).toBe(false)
        expect(localStorage.getItem('token')).toBeNull()
    })

    test('login throws on invalid credentials', async () => {
        const { result } = renderHook(() => useAuth(), { wrapper })
        await expect(
            act(async () => {
                await result.current.login({ email: 'wrong@test.com', password: 'wrong' })
            }),
        ).rejects.toThrow()
    })
})
