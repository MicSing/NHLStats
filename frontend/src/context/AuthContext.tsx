import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import type { AuthContextType, LoginCredentials, User } from '../types/auth'
import apiClient from '../services/apiClient'

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(() => {
        const stored = localStorage.getItem('user')
        return stored ? (JSON.parse(stored) as User) : null
    })

    const [token, setToken] = useState<string | null>(() =>
        localStorage.getItem('token'),
    )

    const login = async (credentials: LoginCredentials): Promise<void> => {
        const { token: newToken } = await apiClient.post<{ token: string }>(
            '/api/auth/login',
            credentials,
        )
        // Store token before calling /me so the auth header is included
        localStorage.setItem('token', newToken)
        const newUser = await apiClient.get<User>('/api/auth/me')
        setToken(newToken)
        setUser(newUser)
        localStorage.setItem('user', JSON.stringify(newUser))
    }

    const logout = (): void => {
        setToken(null)
        setUser(null)
        localStorage.removeItem('token')
        localStorage.removeItem('user')
    }

    return (
        <AuthContext.Provider
            value={{ user, token, login, logout, isAuthenticated: !!token }}
        >
            {children}
        </AuthContext.Provider>
    )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextType {
    const context = useContext(AuthContext)
    if (!context) throw new Error('useAuth must be used within AuthProvider')
    return context
}

// eslint-disable-next-line react-refresh/only-export-components
export function useIsAdmin(): boolean {
    const { user } = useAuth()
    return user?.roles?.includes('Admin') ?? false
}
