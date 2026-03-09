export interface User {
    id: string
    email: string
    userId: number | null
    roles: string[]
}

export interface LoginCredentials {
    email: string
    password: string
}

export interface AuthContextType {
    user: User | null
    token: string | null
    login: (credentials: LoginCredentials) => Promise<void>
    logout: () => void
    isAuthenticated: boolean
}
