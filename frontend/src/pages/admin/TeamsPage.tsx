import { useEffect, useState } from 'react'
import type { Team } from '../../types/team'
import apiClient from '../../services/apiClient'
import Modal from '../../components/Modal'
import { useTranslation } from 'react-i18next'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorMessage from '../../components/ErrorMessage'
import SearchInput from '../../components/SearchInput'
import Pagination from '../../components/Pagination'
import useTable from '../../hooks/useTable'
import { useToast } from '../../context/ToastContext'

interface TeamForm {
    name: string
    shortName: string
}

export default function TeamsPage() {
    const { t } = useTranslation()
    const toast = useToast()
    const [teams, setTeams] = useState<Team[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Add modal
    const [showAddModal, setShowAddModal] = useState(false)
    const [addForm, setAddForm] = useState<TeamForm>({ name: '', shortName: '' })

    // Edit modal
    const [editTeam, setEditTeam] = useState<Team | null>(null)
    const [editForm, setEditForm] = useState<TeamForm>({ name: '', shortName: '' })

    const { pageItems, totalFiltered, search, setSearch, currentPage, setCurrentPage } = useTable({
        data: teams,
        searchFields: (t) => [t.name, t.shortName],
    })

    const loadTeams = async () => {
        try {
            const data = await apiClient.get<Team[]>('/api/teams')
            setTeams(data)
        } catch {
            setError(t('errors.failedToLoadData'))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void loadTeams()
    }, [])

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            await apiClient.post<Team>('/api/teams', addForm)
            setAddForm({ name: '', shortName: '' })
            setShowAddModal(false)
            toast.success(t('toast.createSuccess'))
            await loadTeams()
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editTeam) return
        try {
            await apiClient.put<Team>(`/api/teams/${editTeam.id}`, editForm)
            setEditTeam(null)
            toast.success(t('toast.saveSuccess'))
            await loadTeams()
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    const handleDelete = async (team: Team) => {
        if (!confirm(t('admin.teams.deleteConfirm', { name: team.name }))) return
        try {
            await apiClient.delete(`/api/teams/${team.id}`)
            toast.success(t('toast.deleteSuccess'))
            await loadTeams()
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    const openEdit = (team: Team) => {
        setEditTeam(team)
        setEditForm({ name: team.name, shortName: team.shortName })
    }

    if (loading) return <LoadingSpinner />
    if (error) return <ErrorMessage message={error} onRetry={() => void loadTeams()} />

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-primary">{t('admin.teams.title')}</h1>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-primary hover:bg-primary-hover px-4 py-2 rounded text-sm font-medium"
                >
                    {t('admin.teams.addTeam')}
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
                            <th className="pb-2 pr-4">{t('admin.teams.short')}</th>
                            <th className="pb-2">{t('common.actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pageItems.map((team) => (
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
                                        {t('common.edit')}
                                    </button>
                                    <button
                                        onClick={() => void handleDelete(team)}
                                        className="text-xs bg-red-900 hover:bg-red-800 px-3 py-1 rounded"
                                    >
                                        {t('common.delete')}
                                    </button>
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
                <Modal title={t('admin.teams.addTeam')} onClose={() => setShowAddModal(false)}>
                    <form onSubmit={(e) => void handleAdd(e)}>
                        <label htmlFor="add-team-name" className="label">{t('common.name')}</label>
                        <input
                            id="add-team-name"
                            className="w-full bg-border border border-border rounded px-3 py-2 mb-3 text-white"
                            value={addForm.name}
                            onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                            placeholder={t('admin.teams.namePlaceholder')}
                            required
                        />
                        <label htmlFor="add-team-short" className="label">{t('admin.teams.shortName')}</label>
                        <input
                            id="add-team-short"
                            className="w-full bg-border border border-border rounded px-3 py-2 mb-4 text-white uppercase"
                            value={addForm.shortName}
                            onChange={(e) => setAddForm({ ...addForm, shortName: e.target.value.toUpperCase() })}
                            placeholder={t('admin.teams.shortPlaceholder')}
                            maxLength={10}
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
            {editTeam && (
                <Modal title={t('admin.teams.editTeam')} onClose={() => setEditTeam(null)}>
                    <form onSubmit={(e) => void handleEdit(e)}>
                        <label htmlFor="edit-team-name" className="label">{t('common.name')}</label>
                        <input
                            id="edit-team-name"
                            className="w-full bg-border border border-border rounded px-3 py-2 mb-3 text-white"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            required
                        />
                        <label htmlFor="edit-team-short" className="label">{t('admin.teams.shortName')}</label>
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
