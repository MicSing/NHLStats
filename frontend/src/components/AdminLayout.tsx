import { Navigate } from 'react-router-dom'
import { useIsAdmin } from '../context/AuthContext'
import PublicLayout from './PublicLayout'

export default function AdminLayout() {
    const isAdmin = useIsAdmin()
    if (!isAdmin) return <Navigate to="/" replace />
    return <PublicLayout />
}
