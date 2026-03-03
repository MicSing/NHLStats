import { useEffect, useState } from 'react'
import type { Team } from '../../types/team'
import apiClient from '../../services/apiClient'
import Modal from '../../components/Modal'

interface TeamForm {
    name: string
    shortName: string
}

export default function TeamsPage() {
    const [teams, setTeams] = useState<Team[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Add modal
    const [showAddModal, setShowAddModal] = useState(false)
    const [addForm, setAddForm] = useState<TeamForm>({ name: '', shortName: '' })

    // Edit modal
    const [editTeam, setEditTeam] = useState<Team | null>(null)
    const [editForm, setEditForm] = useState<TeamForm>({ name: '', shortName: '' })

    const loadTeams = async () => {
        try {
            const data = await apiClient.get<Team[]>('/api/teams')
            setTeams(data)
        } catch {
            setError('Failed to load teams')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void loadTeams()
    }, [])

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        await apiClient.post<Team>('/api/teams', addForm)
        setAddForm({ name: '', shortName: '' })
        setShowAddModal(false)
        await loadTeams()
    }

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editTeam) return
        await apiClient.put<Team>(`/api/teams/${editTeam.id}`, editForm)
        setEditTeam(null)
        await loadTeams()
    }

    const handleDelete = async (team: Team) => {
        if (!confirm(`Delete "${team.name}"? This cannot be undone.`)) return
        await apiClient.delete(`/api/teams/${team.id}`)
        await loadTeams()
    }

    const openEdit = (team: Team) => {
        setEditTeam(team)
        setEditForm({ name: team.name, shortName: team.shortName })
    }

    if (loading) return <p>Loading…</p>
    if (error) return <p role="alert">{error}</p>

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-primary">Teams</h1>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-primary hover:bg-primary-hover px-4 py-2 rounded text-sm font-medium"
                >
                    Add Team
                </button>
            </div>

            <table className="w-full text-sm">
                <thead>
                    <tr className="text-left border-b border-border text-text-muted">
                        <th className="pb-2 pr-4">Name</th>
                        <th className="pb-2 pr-4">Short</th>
                        <th className="pb-2">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {teams.map((team) => (
                        <tr key={team.id} className="border-b border-border/50">
                            <td className="py-3 pr-4">{team.name}</td>
                            <td className="py-3 pr-4">
                                <span className="font-mono text-xs bg-border px-2 py-0.5 rounded">
                                    {team.shortName}
                                </span>
                            </td>
                            <td className="py-3 flex gap-2">
                                <button
                                    onClick={() => openEdit(team)}
                                    className="text-xs bg-border hover:bg-border/80 px-3 py-1 rounded"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => void handleDelete(team)}
                                    className="text-xs bg-red-900 hover:bg-red-800 px-3 py-1 rounded"
                                >
                                    Delete
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Add modal */}
            {showAddModal && (
                <Modal title="Add Team" onClose={() => setShowAddModal(false)}>
                    <form onSubmit={(e) => void handleAdd(e)}>
                        <label htmlFor="add-team-name" className="label">Name</label>
                        <input
                            id="add-team-name"
                            className="w-full bg-border border border-border rounded px-3 py-2 mb-3 text-white"
                            value={addForm.name}
                            onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                            placeholder="e.g. Utah Mammoth"
                            required
                        />
                        <label htmlFor="add-team-short" className="label">Short Name</label>
                        <input
                            id="add-team-short"
                            className="w-full bg-border border border-border rounded px-3 py-2 mb-4 text-white uppercase"
                            value={addForm.shortName}
                            onChange={(e) => setAddForm({ ...addForm, shortName: e.target.value.toUpperCase() })}
                            placeholder="e.g. UTA"
                            maxLength={10}
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
            {editTeam && (
                <Modal title="Edit Team" onClose={() => setEditTeam(null)}>
                    <form onSubmit={(e) => void handleEdit(e)}>
                        <label htmlFor="edit-team-name" className="label">Name</label>
                        <input
                            id="edit-team-name"
                            className="w-full bg-border border border-border rounded px-3 py-2 mb-3 text-white"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            required
                        />
                        <label htmlFor="edit-team-short" className="label">Short Name</label>
                        <input
                            id="edit-team-short"
                            className="w-full bg-border border border-border rounded px-3 py-2 mb-4 text-white uppercase"
                            value={editForm.shortName}
                            onChange={(e) => setEditForm({ ...editForm, shortName: e.target.value.toUpperCase() })}
                            maxLength={10}
                            required
                        />
                        <div className="flex gap-2 justify-end">
                            <button
                                type="button"
                                onClick={() => setEditTeam(null)}
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
