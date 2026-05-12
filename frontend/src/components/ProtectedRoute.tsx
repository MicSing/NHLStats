import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface ProtectedRouteProps {
    children: ReactNode
}

interface AdminProtectedRouteProps {
    children: ReactNode
    redirectTo?: string
}

function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { isAuthenticated } = useAuth()
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />
    }
    return <>{children}</>
}

export function AdminProtectedRoute({ children, redirectTo = '/' }: AdminProtectedRouteProps) {
    const { isAuthenticated, user } = useAuth()
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />
    }
    if (!user?.roles?.includes('Admin')) {
        return <Navigate to={redirectTo} replace />
    }
    return <>{children}</>
}

export default ProtectedRoute
