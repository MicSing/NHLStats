import { useEffect, useState } from 'react'
import type { User, CreateUserDto, UpdateUserDto } from '../../types/user'
import apiClient from '../../services/apiClient'
import { cacheService } from '../../services/cacheService'
import Modal from '../../components/Modal'
import { useTranslation } from 'react-i18next'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorMessage from '../../components/ErrorMessage'
import SearchInput from '../../components/SearchInput'
import Pagination from '../../components/Pagination'
import useTable from '../../hooks/useTable'
import { useToast } from '../../context/ToastContext'

export default function UsersPage() {
    const { t } = useTranslation()
    const toast = useToast()
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Add modal
    const [showAddModal, setShowAddModal] = useState(false)
    const [newName, setNewName] = useState('')

    // Edit modal
    const [editUser, setEditUser] = useState<User | null>(null)
    const [editName, setEditName] = useState('')
    const [editIsActive, setEditIsActive] = useState(true)

    const { pageItems, totalFiltered, search, setSearch, currentPage, setCurrentPage } = useTable({
        data: users,
        searchFields: (u) => [u.name],
    })

    const loadUsers = async () => {
        try {
            const data = await cacheService.getUsers(true)
            setUsers(data)
        } catch {
            setError(t('errors.failedToLoadUsers'))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void loadUsers()
    }, [])

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            await apiClient.post<User>('/api/users', { name: newName } satisfies CreateUserDto)
            cacheService.invalidateUsers()
            setNewName('')
            setShowAddModal(false)
            toast.success(t('toast.createSuccess'))
            await loadUsers()
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editUser) return
        try {
            const dto: UpdateUserDto = { name: editName, isActive: editIsActive }
            await apiClient.put<User>(`/api/users/${editUser.id}`, dto)
            cacheService.invalidateUsers()
            setEditUser(null)
            toast.success(t('toast.saveSuccess'))
            await loadUsers()
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    const handleDeactivate = async (user: User) => {
        try {
            await apiClient.put<User>(`/api/users/${user.id}`, {
                name: user.name,
                isActive: false,
            } satisfies UpdateUserDto)
            cacheService.invalidateUsers()
            toast.success(t('toast.saveSuccess'))
            await loadUsers()
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    const openEdit = (user: User) => {
        setEditUser(user)
        setEditName(user.name)
        setEditIsActive(user.isActive)
    }

    if (loading) return <LoadingSpinner />
    if (error) return <ErrorMessage message={error} onRetry={() => void loadUsers()} />

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-primary">{t('admin.users.title')}</h1>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-primary hover:bg-primary-hover px-4 py-2 rounded text-sm font-medium"
                >
                    {t('admin.users.addUser')}
                </button>
            </div>

            <div className="mb-4">
                <SearchInput value={search} onChange={setSearch} placeholder={t('common.search')} />
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left border-b border-border text-text-muted">
                            <th className="pb-2 pr-4">{t('common.name')}</th>
                            <th className="pb-2 pr-4">{t('common.status')}</th>
                            <th className="pb-2">{t('common.actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pageItems.map((user) => (
                            <tr key={user.id} className="border-b border-border/50">
                                <td className="py-3 pr-4">{user.name}</td>
                                <td className="py-3 pr-4">
                                    <span
                                        className={`text-xs px-2 py-1 rounded-full ${user.isActive
                                            ? 'bg-success/20 text-success'
                                            : 'bg-border text-text-muted'
                                            }`}
                                    >
                                        {user.isActive ? t('common.active') : t('common.inactive')}
                                    </span>
                                </td>
                                <td className="py-3 flex gap-2">
                                    <button
                                        onClick={() => openEdit(user)}
                                        className="text-xs bg-border hover:bg-border/80 px-3 py-1 rounded"
                                    >
                                        {t('common.edit')}
                                    </button>
                                    {user.isActive && (
                                        <button
                                            onClick={() => void handleDeactivate(user)}
                                            className="text-xs bg-warning/20 hover:bg-warning/30 text-warning px-3 py-1 rounded"
                                        >
                                            {t('common.deactivate')}
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Pagination
                currentPage={currentPage}
                totalItems={totalFiltered}
                pageSize={20}
                onPageChange={setCurrentPage}
            />

            {/* Add modal */}
            {showAddModal && (
                <Modal title={t('admin.users.addUser')} onClose={() => setShowAddModal(false)}>
                    <form onSubmit={(e) => void handleAdd(e)}>
                        <label
                            htmlFor="add-user-name"
                            className="label"
                        >
                            {t('common.name')}
                        </label>
                        <input
                            id="add-user-name"
                            className="w-full bg-border border border-border rounded px-3 py-2 mb-4 text-white"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            required
                        />
                        <div className="flex gap-2 justify-end">
                            <button
                                type="button"
                                onClick={() => setShowAddModal(false)}
                                className="btn-ghost text-sm"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover rounded"
                            >
                                {t('common.save')}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Edit modal */}
            {editUser && (
                <Modal title={t('admin.users.editUser')} onClose={() => setEditUser(null)}>
                    <form onSubmit={(e) => void handleEdit(e)}>
                        <label
                            htmlFor="edit-user-name"
                            className="label"
                        >
                            {t('common.name')}
                        </label>
                        <input
                            id="edit-user-name"
                            className="w-full bg-border border border-border rounded px-3 py-2 mb-4 text-white"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            required
                        />
                        <label className="flex items-center gap-2 mb-4 text-sm text-text cursor-pointer">
                            <input
                                type="checkbox"
                                checked={editIsActive}
                                onChange={(e) => setEditIsActive(e.target.checked)}
                                className="accent-[var(--color-primary)]"
                            />
                            {t('common.active')}
                        </label>
                        <div className="flex gap-2 justify-end">
                            <button
                                type="button"
                                onClick={() => setEditUser(null)}
                                className="btn-ghost text-sm"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover rounded"
                            >
                                {t('common.save')}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    )
}
