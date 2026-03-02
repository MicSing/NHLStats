/**
 * Isolated test for AuthContext localStorage persistence.
 * Kept in its own file so it runs in a fresh jsdom environment,
 * unaffected by async React 18 work from other test suites.
 */
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AuthProvider, useAuth } from '../../context/AuthContext'

const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
)

describe('AuthContext — localStorage persistence', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    test('restores token from localStorage on mount', () => {
        localStorage.setItem('token', 'stored-token')
        localStorage.setItem('user', JSON.stringify({ id: 'user-1', email: 'admin@test.com' }))
        const { result } = renderHook(() => useAuth(), { wrapper })
        expect(result.current.token).toBe('stored-token')
        expect(result.current.isAuthenticated).toBe(true)
    })

    test('restores user from localStorage on mount', () => {
        localStorage.setItem('token', 'stored-token')
        localStorage.setItem('user', JSON.stringify({ id: 'user-1', email: 'admin@test.com' }))
        const { result } = renderHook(() => useAuth(), { wrapper })
        expect(result.current.user).toEqual({ id: 'user-1', email: 'admin@test.com' })
    })

    test('starts unauthenticated when localStorage is empty', () => {
        const { result } = renderHook(() => useAuth(), { wrapper })
        expect(result.current.token).toBeNull()
        expect(result.current.user).toBeNull()
        expect(result.current.isAuthenticated).toBe(false)
    })
})
