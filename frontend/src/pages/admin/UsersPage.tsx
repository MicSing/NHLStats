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
                <h1 className="text-2xl font-bold text-cyan-400">Users</h1>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-cyan-600 hover:bg-cyan-700 px-4 py-2 rounded text-sm font-medium"
                >
                    Add User
                </button>
            </div>

            <table className="w-full text-sm">
                <thead>
                    <tr className="text-left border-b border-gray-700 text-gray-400">
                        <th className="pb-2 pr-4">Name</th>
                        <th className="pb-2 pr-4">Status</th>
                        <th className="pb-2">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map((user) => (
                        <tr key={user.id} className="border-b border-gray-700/50">
                            <td className="py-3 pr-4">{user.name}</td>
                            <td className="py-3 pr-4">
                                <span
                                    className={`text-xs px-2 py-1 rounded-full ${user.isActive
                                            ? 'bg-green-800 text-green-200'
                                            : 'bg-gray-700 text-gray-400'
                                        }`}
                                >
                                    {user.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </td>
                            <td className="py-3 flex gap-2">
                                <button
                                    onClick={() => openEdit(user)}
                                    className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded"
                                >
                                    Edit
                                </button>
                                {user.isActive && (
                                    <button
                                        onClick={() => void handleDeactivate(user)}
                                        className="text-xs bg-orange-800 hover:bg-orange-700 px-3 py-1 rounded"
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
                            className="block text-sm mb-1 text-gray-300"
                        >
                            Name
                        </label>
                        <input
                            id="add-user-name"
                            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 mb-4 text-white"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            required
                        />
                        <div className="flex gap-2 justify-end">
                            <button
                                type="button"
                                onClick={() => setShowAddModal(false)}
                                className="px-4 py-2 text-sm bg-gray-700 rounded"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 text-sm bg-cyan-600 hover:bg-cyan-700 rounded"
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
                            className="block text-sm mb-1 text-gray-300"
                        >
                            Name
                        </label>
                        <input
                            id="edit-user-name"
                            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 mb-4 text-white"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            required
                        />
                        <label className="flex items-center gap-2 mb-4 text-sm text-gray-300 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={editIsActive}
                                onChange={(e) => setEditIsActive(e.target.checked)}
                                className="accent-cyan-500"
                            />
                            Active
                        </label>
                        <div className="flex gap-2 justify-end">
                            <button
                                type="button"
                                onClick={() => setEditUser(null)}
                                className="px-4 py-2 text-sm bg-gray-700 rounded"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 text-sm bg-cyan-600 hover:bg-cyan-700 rounded"
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
