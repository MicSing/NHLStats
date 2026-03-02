import { useEffect, useState } from 'react'
import type { Season, SeasonDetail, CreateSeasonDto, UpdateSeasonDto } from '../../types/season'
import type { Team } from '../../types/team'
import type { User } from '../../types/user'
import apiClient from '../../services/apiClient'
import Modal from '../../components/Modal'

export default function SeasonsPage() {
    const [seasons, setSeasons] = useState<Season[]>([])
    const [teams, setTeams] = useState<Team[]>([])
    const [allUsers, setAllUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Add / Edit
    const [showAddModal, setShowAddModal] = useState(false)
    const [editSeason, setEditSeason] = useState<Season | null>(null)
    const [form, setForm] = useState<CreateSeasonDto>({
        name: '',
        startedOn: new Date().toISOString().split('T')[0],
        status: '',
        hostedTeamId: null,
    })

    // Assign users
    const [manageSeason, setManageSeason] = useState<SeasonDetail | null>(null)
    const [assignUserId, setAssignUserId] = useState<number | ''>('')

    const loadAll = async () => {
        try {
            const [seasonsData, teamsData, usersData] = await Promise.all([
                apiClient.get<Season[]>('/api/seasons'),
                apiClient.get<Team[]>('/api/teams'),
                apiClient.get<User[]>('/api/users'),
            ])
            setSeasons(seasonsData)
            setTeams(teamsData)
            setAllUsers(usersData)
        } catch {
            setError('Failed to load data')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void loadAll()
    }, [])

    const resetForm = () =>
        setForm({
            name: '',
            startedOn: new Date().toISOString().split('T')[0],
            status: '',
            hostedTeamId: null,
        })

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        await apiClient.post<Season>('/api/seasons', form)
        setShowAddModal(false)
        resetForm()
        await loadAll()
    }

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editSeason) return
        const dto: UpdateSeasonDto = { ...form }
        await apiClient.put<Season>(`/api/seasons/${editSeason.id}`, dto)
        setEditSeason(null)
        resetForm()
        await loadAll()
    }

    const openEdit = (season: Season) => {
        setEditSeason(season)
        setForm({
            name: season.name,
            startedOn: season.startedOn.split('T')[0],
            status: season.status ?? '',
            hostedTeamId: season.hostedTeamId,
        })
    }

    const handleDelete = async (id: number) => {
        if (!window.confirm('Delete this season?')) return
        await apiClient.delete(`/api/seasons/${id}`)
        await loadAll()
    }

    const openManageUsers = async (season: Season) => {
        const detail = await apiClient.get<SeasonDetail>(`/api/seasons/${season.id}`)
        setManageSeason(detail)
        setAssignUserId('')
    }

    const handleAssignUser = async () => {
        if (!manageSeason || assignUserId === '') return
        const updated = await apiClient.post<SeasonDetail>(
            `/api/seasons/${manageSeason.id}/users/${assignUserId}`,
            {},
        )
        setManageSeason(updated)
        setAssignUserId('')
    }

    const handleRemoveUser = async (userId: number) => {
        if (!manageSeason) return
        await apiClient.delete(`/api/seasons/${manageSeason.id}/users/${userId}`)
        const updated = await apiClient.get<SeasonDetail>(`/api/seasons/${manageSeason.id}`)
        setManageSeason(updated)
    }

    if (loading) return <p>Loading…</p>
    if (error) return <p role="alert">{error}</p>

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-cyan-400">Seasons</h1>
                <button
                    onClick={() => {
                        resetForm()
                        setShowAddModal(true)
                    }}
                    className="bg-cyan-600 hover:bg-cyan-700 px-4 py-2 rounded text-sm font-medium"
                >
                    Add Season
                </button>
            </div>

            <table className="w-full text-sm">
                <thead>
                    <tr className="text-left border-b border-gray-700 text-gray-400">
                        <th className="pb-2 pr-4">Name</th>
                        <th className="pb-2 pr-4">Started</th>
                        <th className="pb-2 pr-4">Status</th>
                        <th className="pb-2 pr-4">Hosted By</th>
                        <th className="pb-2">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {seasons.map((season) => (
                        <tr key={season.id} className="border-b border-gray-700/50">
                            <td className="py-3 pr-4 font-medium">{season.name}</td>
                            <td className="py-3 pr-4 text-gray-300">
                                {new Date(season.startedOn).toLocaleDateString()}
                            </td>
                            <td className="py-3 pr-4">
                                {season.status && (
                                    <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">
                                        {season.status}
                                    </span>
                                )}
                            </td>
                            <td className="py-3 pr-4 text-gray-300">
                                {season.hostedTeamName ?? '—'}
                            </td>
                            <td className="py-3 flex gap-2">
                                <button
                                    onClick={() => openEdit(season)}
                                    className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => void openManageUsers(season)}
                                    className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded"
                                >
                                    Users
                                </button>
                                <button
                                    onClick={() => void handleDelete(season.id)}
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
                <Modal title="Add Season" onClose={() => setShowAddModal(false)}>
                    <SeasonForm
                        form={form}
                        teams={teams}
                        onChange={setForm}
                        onSubmit={(e) => void handleAdd(e)}
                        onCancel={() => setShowAddModal(false)}
                    />
                </Modal>
            )}

            {/* Edit modal */}
            {editSeason && (
                <Modal title="Edit Season" onClose={() => setEditSeason(null)}>
                    <SeasonForm
                        form={form}
                        teams={teams}
                        onChange={setForm}
                        onSubmit={(e) => void handleEdit(e)}
                        onCancel={() => setEditSeason(null)}
                    />
                </Modal>
            )}

            {/* Manage users modal */}
            {manageSeason && (
                <Modal
                    title={`Users — ${manageSeason.name}`}
                    onClose={() => setManageSeason(null)}
                >
                    <ul className="mb-4 space-y-2">
                        {manageSeason.users.length === 0 && (
                            <li className="text-gray-400 text-sm">No users assigned</li>
                        )}
                        {manageSeason.users.map((u) => (
                            <li
                                key={u.id}
                                className="flex items-center justify-between text-sm"
                            >
                                <span>{u.name}</span>
                                <button
                                    onClick={() => void handleRemoveUser(u.id)}
                                    className="text-xs bg-red-900 hover:bg-red-800 px-2 py-1 rounded"
                                >
                                    Remove
                                </button>
                            </li>
                        ))}
                    </ul>

                    <div className="flex gap-2">
                        <select
                            aria-label="Select user to assign"
                            value={assignUserId}
                            onChange={(e) =>
                                setAssignUserId(e.target.value === '' ? '' : Number(e.target.value))
                            }
                            className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                        >
                            <option value="">Select user…</option>
                            {allUsers
                                .filter((u) => !manageSeason.users.some((su) => su.id === u.id))
                                .map((u) => (
                                    <option key={u.id} value={u.id}>
                                        {u.name}
                                    </option>
                                ))}
                        </select>
                        <button
                            onClick={() => void handleAssignUser()}
                            disabled={assignUserId === ''}
                            className="px-3 py-2 text-sm bg-cyan-600 hover:bg-cyan-700 rounded disabled:opacity-50"
                        >
                            Assign
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    )
}

// ---- Extracted season form ----

interface SeasonFormProps {
    form: CreateSeasonDto
    teams: Team[]
    onChange: (f: CreateSeasonDto) => void
    onSubmit: (e: React.FormEvent) => void
    onCancel: () => void
}

function SeasonForm({ form, teams, onChange, onSubmit, onCancel }: SeasonFormProps) {
    const set = (patch: Partial<CreateSeasonDto>) => onChange({ ...form, ...patch })

    return (
        <form onSubmit={onSubmit}>
            <label htmlFor="season-name" className="block text-sm mb-1 text-gray-300">
                Name
            </label>
            <input
                id="season-name"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 mb-3 text-white"
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
                required
            />

            <label htmlFor="season-started-on" className="block text-sm mb-1 text-gray-300">
                Started On
            </label>
            <input
                id="season-started-on"
                type="date"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 mb-3 text-white"
                value={form.startedOn}
                onChange={(e) => set({ startedOn: e.target.value })}
                required
            />

            <label htmlFor="season-status" className="block text-sm mb-1 text-gray-300">
                Status
            </label>
            <input
                id="season-status"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 mb-3 text-white"
                value={form.status ?? ''}
                onChange={(e) => set({ status: e.target.value || null })}
                placeholder="e.g. Active, Completed"
            />

            <label htmlFor="season-team" className="block text-sm mb-1 text-gray-300">
                Hosted By
            </label>
            <select
                id="season-team"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 mb-4 text-white"
                value={form.hostedTeamId ?? ''}
                onChange={(e) =>
                    set({ hostedTeamId: e.target.value ? Number(e.target.value) : null })
                }
            >
                <option value="">None</option>
                {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                        {t.name}
                    </option>
                ))}
            </select>

            <div className="flex gap-2 justify-end">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm bg-gray-700 rounded">
                    Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm bg-cyan-600 hover:bg-cyan-700 rounded">
                    Save
                </button>
            </div>
        </form>
    )
}
