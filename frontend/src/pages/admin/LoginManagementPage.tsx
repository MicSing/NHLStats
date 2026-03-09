import { useEffect, useState } from 'react'
import type { User } from '../../types/user'
import type { LoginUser, CreateLoginDto, UpdateLoginRolesDto, AttachUserDto } from '../../types/loginManagement'
import apiClient from '../../services/apiClient'
import Modal from '../../components/Modal'
import { useTranslation } from 'react-i18next'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorMessage from '../../components/ErrorMessage'
import Pagination from '../../components/Pagination'
import { useToast } from '../../context/ToastContext'

export default function LoginManagementPage() {
    const { t } = useTranslation()
    const toast = useToast()
    const [users, setUsers] = useState<LoginUser[]>([])
    const [appUsers, setAppUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Add user modal
    const [showAddModal, setShowAddModal] = useState(false)
    const [newEmail, setNewEmail] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [newRoles, setNewRoles] = useState<string[]>(['Participient'])
    const [newUserId, setNewUserId] = useState<number | undefined>(undefined)
    const [addLoading, setAddLoading] = useState(false)
    const [roleSavingById, setRoleSavingById] = useState<Record<string, boolean>>({})
    const [attachSavingById, setAttachSavingById] = useState<Record<string, boolean>>({})
    const [editedRolesById, setEditedRolesById] = useState<Record<string, string[]>>({})
    const [selectedUserByLoginId, setSelectedUserByLoginId] = useState<Record<string, string>>({})

    // Change password modal
    const [showChangePasswordModal, setShowChangePasswordModal] = useState(false)
    const [passwordChangeUserId, setPasswordChangeUserId] = useState<string | null>(null)
    const [changePasswordNewPassword, setChangePasswordNewPassword] = useState('')
    const [passwordChangeLoading, setPasswordChangeLoading] = useState(false)

    // Pagination
    const [currentPage, setCurrentPage] = useState(1)
    const pageSize = 10
    const totalItems = users.length
    const paginatedUsers = users.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    )

    const loadUsers = async () => {
        try {
            setLoading(true)
            const [loginData, appUsersData] = await Promise.all([
                apiClient.get<LoginUser[]>('/api/auth/users'),
                apiClient.get<User[]>('/api/users'),
            ])

            setUsers(loginData)
            setAppUsers(appUsersData)
            setEditedRolesById(
                Object.fromEntries(loginData.map((u) => [u.id, u.roles]))
            )
            setSelectedUserByLoginId(
                Object.fromEntries(loginData.map((u) => [u.id, u.userId != null ? String(u.userId) : '']))
            )
            setError(null)
        } catch {
            setError(t('errors.failedToLoadUsers'))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void loadUsers()
    }, [])

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newEmail || !newPassword) {
            toast.error(t('errors.allFieldsRequired'))
            return
        }

        setAddLoading(true)
        try {
            const dto: CreateLoginDto = {
                email: newEmail,
                password: newPassword,
                userId: newUserId,
            }
            await apiClient.post('/api/auth/users', dto)
            toast.success(t('toast.createSuccess'))
            setShowAddModal(false)
            setNewEmail('')
            setNewPassword('')
            setNewRoles(['Participient'])
            setNewUserId(undefined)
            await loadUsers()
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t('toast.operationFailed'))
        } finally {
            setAddLoading(false)
        }
    }

    const handleSaveRoles = async (login: LoginUser) => {
        const roles = editedRolesById[login.id] ?? login.roles
        const dto: UpdateLoginRolesDto = {
            roles,
        }

        setRoleSavingById((prev) => ({ ...prev, [login.id]: true }))
        try {
            await apiClient.put(`/api/auth/users/${login.id}/roles`, dto)
            toast.success(t('toast.saveSuccess'))
            await loadUsers()
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t('toast.operationFailed'))
        } finally {
            setRoleSavingById((prev) => ({ ...prev, [login.id]: false }))
        }
    }

    const handleAttachUser = async (login: LoginUser) => {
        const rawUserId = selectedUserByLoginId[login.id]
        if (!rawUserId) {
            toast.error(t('errors.allFieldsRequired'))
            return
        }

        const dto: AttachUserDto = { userId: Number(rawUserId) }
        setAttachSavingById((prev) => ({ ...prev, [login.id]: true }))
        try {
            await apiClient.put(`/api/auth/users/${login.id}/attach-user`, dto)
            toast.success(t('toast.saveSuccess'))
            await loadUsers()
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t('toast.operationFailed'))
        } finally {
            setAttachSavingById((prev) => ({ ...prev, [login.id]: false }))
        }
    }

    const handleDeleteUser = async (userId: string) => {
        if (!window.confirm(t('confirm.deleteUser'))) return

        try {
            await apiClient.delete(`/api/auth/users/${userId}`)
            toast.success(t('toast.deleteSuccess'))
            await loadUsers()
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    const handleOpenChangePasswordModal = (userId: string) => {
        setPasswordChangeUserId(userId)
        setChangePasswordNewPassword('')
        setShowChangePasswordModal(true)
    }

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!passwordChangeUserId || !changePasswordNewPassword) {
            toast.error(t('errors.allFieldsRequired'))
            return
        }

        if (changePasswordNewPassword.length < 6) {
            toast.error('Password must be at least 6 characters')
            return
        }

        setPasswordChangeLoading(true)
        try {
            await apiClient.post(`/api/auth/users/${passwordChangeUserId}/change-password`, {
                newPassword: changePasswordNewPassword,
            })
            toast.success('Password changed successfully')
            setShowChangePasswordModal(false)
            setPasswordChangeUserId(null)
            setChangePasswordNewPassword('')
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to change password')
        } finally {
            setPasswordChangeLoading(false)
        }
    }

    if (loading) return <LoadingSpinner />
    if (error) return <ErrorMessage message={error} onRetry={() => void loadUsers()} />

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">{t('nav.loginManagement')}</h1>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                    {t('common.add')} {t('common.user')}
                </button>
            </div>

            {showAddModal && (
                <Modal title={t('nav.loginManagement')} onClose={() => setShowAddModal(false)}>
                    <form onSubmit={handleAddUser} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Email</label>
                            <input
                                type="email"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">{t('login.password')}</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
                            />
                        </div>
                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="adminRole"
                                checked={newRoles.includes('Admin')}
                                onChange={(e) => setNewRoles(e.target.checked ? ['Participient', 'Admin'] : ['Participient'])}
                                className="w-4 h-4"
                            />
                            <label htmlFor="adminRole" className="ml-2 text-sm font-medium">
                                Admin User
                            </label>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Attach to User (optional)</label>
                            <select
                                value={newUserId != null ? String(newUserId) : ''}
                                onChange={(e) => setNewUserId(e.target.value ? Number(e.target.value) : undefined)}
                                className="w-full px-3 py-2 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
                            >
                                <option value="">{t('common.none')}</option>
                                {appUsers.map((user) => (
                                    <option key={user.id} value={user.id}>
                                        {user.name} (#{user.id})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex gap-2 pt-4">
                            <button
                                type="submit"
                                disabled={addLoading}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                                {addLoading ? t('common.creating') : t('common.create')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowAddModal(false)}
                                className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
                            >
                                {t('common.cancel')}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {showChangePasswordModal && (
                <Modal title="Change Password" onClose={() => setShowChangePasswordModal(false)}>
                    <form onSubmit={handleChangePassword} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">New Password</label>
                            <input
                                type="password"
                                value={changePasswordNewPassword}
                                onChange={(e) => setChangePasswordNewPassword(e.target.value)}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
                                placeholder="Enter new password (min 6 characters)"
                            />
                        </div>
                        <div className="flex gap-2 pt-4">
                            <button
                                type="submit"
                                disabled={passwordChangeLoading}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                                {passwordChangeLoading ? t('common.saving') : 'Change Password'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowChangePasswordModal(false)}
                                className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
                            >
                                {t('common.cancel')}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-100 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-sm font-semibold">Email</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold">Roles</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold">Linked User</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold">{t('common.actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedUsers.map((user) => (
                            <tr
                                key={user.id}
                                className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                            >
                                <td className="px-6 py-4 text-sm">{user.email}</td>
                                <td className="px-6 py-4 text-sm">
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {user.roles.map((role) => (
                                            <span
                                                key={`${user.id}-${role}`}
                                                className={`px-2 py-1 rounded text-white text-xs ${role === 'Admin' ? 'bg-red-600' : 'bg-green-600'}`}
                                            >
                                                {role}
                                            </span>
                                        ))}
                                    </div>
                                    <label className="inline-flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={(editedRolesById[user.id] ?? user.roles).includes('Admin')}
                                            onChange={(e) => setEditedRolesById((prev) => ({ ...prev, [user.id]: e.target.checked ? ['Participient', 'Admin'] : ['Participient'] }))}
                                        />
                                        <span>Admin</span>
                                    </label>
                                </td>
                                <td className="px-6 py-4 text-sm">
                                    <select
                                        value={selectedUserByLoginId[user.id] ?? ''}
                                        onChange={(e) => setSelectedUserByLoginId((prev) => ({ ...prev, [user.id]: e.target.value }))}
                                        className="w-full px-2 py-1 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
                                    >
                                        <option value="">{t('common.none')}</option>
                                        {appUsers.map((appUser) => (
                                            <option key={appUser.id} value={appUser.id}>
                                                {appUser.name} (#{appUser.id})
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td className="px-6 py-4 text-sm">
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => void handleSaveRoles(user)}
                                            disabled={!!roleSavingById[user.id]}
                                            className="text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                                        >
                                            {roleSavingById[user.id] ? t('common.saving') : 'Save Roles'}
                                        </button>
                                        <button
                                            onClick={() => void handleAttachUser(user)}
                                            disabled={!!attachSavingById[user.id]}
                                            className="text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50"
                                        >
                                            {attachSavingById[user.id] ? t('common.saving') : 'Attach User'}
                                        </button>
                                        <button
                                            onClick={() => handleOpenChangePasswordModal(user.id)}
                                            className="text-amber-600 hover:text-amber-800 font-medium"
                                        >
                                            {t('common.changePassword') || 'Change Password'}
                                        </button>
                                        <button
                                            onClick={() => void handleDeleteUser(user.id)}
                                            className="text-red-600 hover:text-red-800 font-medium"
                                        >
                                            {t('common.delete')}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {totalItems > pageSize && (
                <Pagination
                    currentPage={currentPage}
                    totalItems={totalItems}
                    pageSize={pageSize}
                    onPageChange={setCurrentPage}
                />
            )}
        </div>
    )
}
