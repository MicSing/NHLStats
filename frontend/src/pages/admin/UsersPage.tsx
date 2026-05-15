import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { User, CreateUserDto, UpdateUserDto } from '../../types/user'
import type { LoginUser, CreateLoginDto } from '../../types/loginManagement'
import apiClient from '../../services/apiClient'
import { cacheService } from '../../services/cacheService'
import { useToast } from '../../context/ToastContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorMessage from '../../components/ErrorMessage'
import type { MergedUser } from '../../components/users/userTypes'
import UsersTable from '../../components/users/UsersTable'
import UserDrawer from '../../components/users/UserDrawer'
import AddUserModal from '../../components/users/AddUserModal'

export default function UsersPage() {
    const { t } = useTranslation()
    const toast = useToast()

    const [appUsers, setAppUsers] = useState<User[]>([])
    const [loginUsers, setLoginUsers] = useState<LoginUser[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
    const [showAddUserModal, setShowAddUserModal] = useState(false)

    const load = async () => {
        try {
            setLoading(true)
            const [usersData, loginData] = await Promise.all([
                cacheService.getUsers(true),
                apiClient.get<LoginUser[]>('/api/auth/users'),
            ])
            setAppUsers(usersData)
            setLoginUsers(loginData)
            setError(null)
        } catch {
            setError(t('errors.failedToLoadUsers'))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void load()
    }, [])

    const mergedUsers = useMemo<MergedUser[]>(
        () => appUsers.map((u) => ({ ...u, logins: loginUsers.filter((l) => l.userId === u.id) })),
        [appUsers, loginUsers],
    )

    const filteredUsers = useMemo(() => {
        const q = search.toLowerCase()
        if (!q) return mergedUsers
        return mergedUsers.filter(
            (u) =>
                u.name.toLowerCase().includes(q) ||
                u.logins.some(
                    (l) => l.email?.toLowerCase().includes(q) || l.alias?.toLowerCase().includes(q),
                ),
        )
    }, [mergedUsers, search])

    const selectedUser = mergedUsers.find((u) => u.id === selectedUserId) ?? null

    const handleAddUser = async (name: string) => {
        await apiClient.post<User>('/api/users', { name } satisfies CreateUserDto)
        cacheService.invalidateUsers()
        toast.success(t('toast.createSuccess'))
        await load()
    }

    const handleDeactivate = async (user: MergedUser) => {
        try {
            await apiClient.put<User>(`/api/users/${user.id}`, {
                name: user.name,
                isActive: false,
            } satisfies UpdateUserDto)
            cacheService.invalidateUsers()
            toast.success(t('toast.saveSuccess'))
            await load()
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    const handleAddIdentity = async (dto: CreateLoginDto) => {
        await apiClient.post('/api/auth/users', dto)
        toast.success(t('toast.createSuccess'))
        await load()
    }

    const handleChangePassword = async (loginId: string, password: string) => {
        await apiClient.post(`/api/auth/users/${loginId}/change-password`, { newPassword: password })
        toast.success(t('toast.saveSuccess'))
    }

    const handleDeleteLogin = async (loginId: string) => {
        if (!window.confirm(t('confirm.deleteUser'))) return
        try {
            await apiClient.delete(`/api/auth/users/${loginId}`)
            toast.success(t('toast.deleteSuccess'))
            await load()
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    const handleSaveRoles = async (login: LoginUser, roles: string[]) => {
        await apiClient.put(`/api/auth/users/${login.id}/roles`, { roles })
        toast.success(t('toast.saveSuccess'))
        await load()
    }

    if (loading) return <LoadingSpinner />
    if (error) return <ErrorMessage message={error} onRetry={() => void load()} />

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-medium tracking-tight text-text">Používatelia a prístupy</h1>
                <p className="text-sm text-text-muted mt-1">
                    Centrálna správa osôb, ich identít a systémových oprávnení.
                </p>
            </div>

            <UsersTable
                filteredUsers={filteredUsers}
                search={search}
                onSearchChange={setSearch}
                onSelectUser={setSelectedUserId}
                onAddUser={() => setShowAddUserModal(true)}
            />

            {selectedUser && (
                <UserDrawer
                    user={selectedUser}
                    onClose={() => setSelectedUserId(null)}
                    onAddIdentity={handleAddIdentity}
                    onChangePassword={handleChangePassword}
                    onDeleteLogin={handleDeleteLogin}
                    onSaveRoles={handleSaveRoles}
                    onDeactivate={handleDeactivate}
                />
            )}

            {showAddUserModal && (
                <AddUserModal
                    onClose={() => setShowAddUserModal(false)}
                    onSubmit={handleAddUser}
                />
            )}
        </div>
    )
}
