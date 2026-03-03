import { useEffect, useState } from 'react'
import type { User, CreateUserDto, UpdateUserDto } from '../../types/user'
import apiClient from '../../services/apiClient'
import Modal from '../../components/Modal'

export default function UsersPage() {
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

    const loadUsers = async () => {
        try {
            const data = await apiClient.get<User[]>('/api/users')
            setUsers(data)
        } catch {
            setError('Failed to load users')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void loadUsers()
    }, [])

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        await apiClient.post<User>('/api/users', { name: newName } satisfies CreateUserDto)
        setNewName('')
        setShowAddModal(false)
        await loadUsers()
    }

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editUser) return
        const dto: UpdateUserDto = { name: editName, isActive: editIsActive }
        await apiClient.put<User>(`/api/users/${editUser.id}`, dto)
        setEditUser(null)
        await loadUsers()
    }

    const handleDeactivate = async (user: User) => {
        await apiClient.put<User>(`/api/users/${user.id}`, {
            name: user.name,
            isActive: false,
        } satisfies UpdateUserDto)
        await loadUsers()
    }

    const openEdit = (user: User) => {
        setEditUser(user)
        setEditName(user.name)
        setEditIsActive(user.isActive)
    }

    if (loading) return <p>Loading…</p>
    if (error) return <p role="alert">{error}</p>

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-primary">Users</h1>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-primary hover:bg-primary-hover px-4 py-2 rounded text-sm font-medium"
                >
                    Add User
                </button>
            </div>

            <table className="w-full text-sm">
                <thead>
                    <tr className="text-left border-b border-border text-text-muted">
                        <th className="pb-2 pr-4">Name</th>
                        <th className="pb-2 pr-4">Status</th>
                        <th className="pb-2">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map((user) => (
                        <tr key={user.id} className="border-b border-border/50">
                            <td className="py-3 pr-4">{user.name}</td>
                            <td className="py-3 pr-4">
                                <span
                                    className={`text-xs px-2 py-1 rounded-full ${user.isActive
                                            ? 'bg-success/20 text-success'
                                            : 'bg-border text-text-muted'
                                        }`}
                                >
                                    {user.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </td>
                            <td className="py-3 flex gap-2">
                                <button
                                    onClick={() => openEdit(user)}
                                    className="text-xs bg-border hover:bg-border/80 px-3 py-1 rounded"
                                >
                                    Edit
                                </button>
                                {user.isActive && (
                                    <button
                                        onClick={() => void handleDeactivate(user)}
                                        className="text-xs bg-warning/20 hover:bg-warning/30 text-warning px-3 py-1 rounded"
                                    >
                                        Deactivate
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Add modal */}
            {showAddModal && (
                <Modal title="Add User" onClose={() => setShowAddModal(false)}>
                    <form onSubmit={(e) => void handleAdd(e)}>
                        <label
                            htmlFor="add-user-name"
                            className="label"
                        >
                            Name
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
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover rounded"
                            >
                                Save
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Edit modal */}
            {editUser && (
                <Modal title="Edit User" onClose={() => setEditUser(null)}>
                    <form onSubmit={(e) => void handleEdit(e)}>
                        <label
                            htmlFor="edit-user-name"
                            className="label"
                        >
                            Name
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
                            Active
                        </label>
                        <div className="flex gap-2 justify-end">
                            <button
                                type="button"
                                onClick={() => setEditUser(null)}
                                className="btn-ghost text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover rounded"
                            >
                                Save
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    )
}
