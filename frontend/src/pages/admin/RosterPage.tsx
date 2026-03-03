import { useEffect, useState } from 'react'
import type { Season } from '../../types/season'
import type { Team } from '../../types/team'
import type { RosterPlayer, CreateRosterPlayerDto, UpdateRosterPlayerDto, CsvImportResultDto } from '../../types/roster'
import apiClient from '../../services/apiClient'
import Modal from '../../components/Modal'

export default function RosterPage() {
    const [seasons, setSeasons] = useState<Season[]>([])
    const [teams, setTeams] = useState<Team[]>([])
    const [selectedSeasonId, setSelectedSeasonId] = useState<number | ''>('')
    const [players, setPlayers] = useState<RosterPlayer[]>([])
    const [loadingSeasons, setLoadingSeasons] = useState(true)
    const [loadingPlayers, setLoadingPlayers] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Add modal
    const [showAddModal, setShowAddModal] = useState(false)
    const [addForm, setAddForm] = useState<CreateRosterPlayerDto>({
        firstName: '',
        surname: '',
        position: '',
        teamId: 0,
    })

    // Edit modal
    const [editPlayer, setEditPlayer] = useState<RosterPlayer | null>(null)
    const [editForm, setEditForm] = useState<UpdateRosterPlayerDto>({
        firstName: '',
        surname: '',
        position: '',
        teamId: 0,
        isActive: true,
    })

    // CSV import
    const [csvContent, setCsvContent] = useState('')
    const [csvResult, setCsvResult] = useState<CsvImportResultDto | null>(null)
    const [showCsvModal, setShowCsvModal] = useState(false)

    // Copy from season
    const [showCopyModal, setShowCopyModal] = useState(false)
    const [copySourceId, setCopySourceId] = useState<number | ''>('')

    useEffect(() => {
        Promise.all([
            apiClient.get<Season[]>('/api/seasons'),
            apiClient.get<Team[]>('/api/teams'),
        ])
            .then(([s, t]) => {
                setSeasons(s)
                setTeams(t)
            })
            .catch(() => setError('Failed to load seasons'))
            .finally(() => setLoadingSeasons(false))
    }, [])

    const loadPlayers = async (seasonId: number) => {
        setLoadingPlayers(true)
        try {
            const data = await apiClient.get<RosterPlayer[]>(`/api/seasons/${seasonId}/roster`)
            setPlayers(data)
        } catch {
            setError('Failed to load roster')
        } finally {
            setLoadingPlayers(false)
        }
    }

    const handleSeasonChange = (id: number | '') => {
        setSelectedSeasonId(id)
        if (id !== '') void loadPlayers(id)
        else setPlayers([])
    }

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        if (selectedSeasonId === '') return
        await apiClient.post<RosterPlayer>(`/api/seasons/${selectedSeasonId}/roster`, addForm)
        setShowAddModal(false)
        setAddForm({ firstName: '', surname: '', position: '', teamId: 0 })
        await loadPlayers(selectedSeasonId)
    }

    const openEdit = (player: RosterPlayer) => {
        setEditPlayer(player)
        setEditForm({
            firstName: player.firstName,
            surname: player.surname,
            position: player.position ?? '',
            teamId: player.teamId,
            isActive: player.isActive,
        })
    }

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editPlayer || selectedSeasonId === '') return
        await apiClient.put<RosterPlayer>(
            `/api/seasons/${selectedSeasonId}/roster/${editPlayer.id}`,
            editForm,
        )
        setEditPlayer(null)
        await loadPlayers(selectedSeasonId)
    }

    const handleDelete = async (playerId: number) => {
        if (selectedSeasonId === '') return
        await apiClient.delete(`/api/seasons/${selectedSeasonId}/roster/${playerId}`)
        await loadPlayers(selectedSeasonId)
    }

    const handleCsvImport = async (e: React.FormEvent) => {
        e.preventDefault()
        if (selectedSeasonId === '') return
        const result = await apiClient.post<CsvImportResultDto>(
            `/api/seasons/${selectedSeasonId}/roster/import`,
            { csvContent },
        )
        setCsvResult(result)
        setCsvContent('')
        setShowCsvModal(false)
        await loadPlayers(selectedSeasonId)
    }

    const handleCopyFromSeason = async (e: React.FormEvent) => {
        e.preventDefault()
        if (selectedSeasonId === '' || copySourceId === '') return
        await apiClient.post<RosterPlayer[]>(
            `/api/seasons/${selectedSeasonId}/roster/copy/${copySourceId}`,
            {},
        )
        setShowCopyModal(false)
        setCopySourceId('')
        await loadPlayers(selectedSeasonId)
    }

    if (loadingSeasons) return <p>Loading…</p>
    if (error) return <p role="alert">{error}</p>

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-primary">Roster</h1>
            </div>

            {/* Season selector */}
            <div className="mb-6">
                <label htmlFor="roster-season-select" className="label">
                    Season
                </label>
                <select
                    id="roster-season-select"
                    value={selectedSeasonId}
                    onChange={(e) =>
                        handleSeasonChange(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="bg-border border border-border rounded px-3 py-2 text-sm text-white min-w-48"
                >
                    <option value="">Select a season…</option>
                    {seasons.map((s) => (
                        <option key={s.id} value={s.id}>
                            {s.name}
                        </option>
                    ))}
                </select>
            </div>

            {selectedSeasonId !== '' && (
                <>
                    <div className="flex gap-2 mb-4">
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="bg-primary hover:bg-primary-hover px-4 py-2 rounded text-sm"
                        >
                            Add Player
                        </button>
                        <button
                            onClick={() => setShowCsvModal(true)}
                            className="bg-border hover:bg-border/80 px-4 py-2 rounded text-sm"
                        >
                            Import CSV
                        </button>
                        <button
                            onClick={() => setShowCopyModal(true)}
                            className="bg-border hover:bg-border/80 px-4 py-2 rounded text-sm"
                        >
                            Copy from Season
                        </button>
                    </div>

                    {csvResult && (
                        <p className="mb-4 text-sm text-success">
                            Imported {csvResult.imported} player(s).
                            {csvResult.errors.length > 0 && (
                                <span className="text-warning"> {csvResult.errors.join('; ')}</span>
                            )}
                        </p>
                    )}

                    {loadingPlayers ? (
                        <p>Loading roster…</p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left border-b border-border text-text-muted">
                                    <th className="pb-2 pr-4">Name</th>
                                    <th className="pb-2 pr-4">Position</th>
                                    <th className="pb-2 pr-4">Team</th>
                                    <th className="pb-2 pr-4">Status</th>
                                    <th className="pb-2">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {players.map((p) => (
                                    <tr key={p.id} className="border-b border-border/50">
                                        <td className="py-3 pr-4">
                                            {p.firstName} {p.surname}
                                        </td>
                                        <td className="py-3 pr-4 text-text">{p.position ?? '—'}</td>
                                        <td className="py-3 pr-4 text-text">{p.teamShortName}</td>
                                        <td className="py-3 pr-4">
                                            <span
                                                className={`text-xs px-2 py-1 rounded-full ${p.isActive
                                                        ? 'bg-success/20 text-success'
                                                        : 'bg-border text-text-muted'
                                                    }`}
                                            >
                                                {p.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="py-3 flex gap-2">
                                            <button
                                                onClick={() => openEdit(p)}
                                                className="text-xs bg-border hover:bg-border/80 px-3 py-1 rounded"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => void handleDelete(p.id)}
                                                className="text-xs bg-red-900 hover:bg-red-800 px-3 py-1 rounded"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </>
            )}

            {selectedSeasonId === '' && (
                <p className="text-text-muted text-sm">Select a season to manage its roster.</p>
            )}

            {/* Add player modal */}
            {showAddModal && (
                <Modal title="Add Player" onClose={() => setShowAddModal(false)}>
                    <PlayerForm
                        form={addForm}
                        teams={teams}
                        showIsActive={false}
                        isActive={true}
                        onChange={(f) => setAddForm(f as CreateRosterPlayerDto)}
                        onSubmit={(e) => void handleAdd(e)}
                        onCancel={() => setShowAddModal(false)}
                    />
                </Modal>
            )}

            {/* Edit player modal */}
            {editPlayer && (
                <Modal
                    title={`Edit — ${editPlayer.firstName} ${editPlayer.surname}`}
                    onClose={() => setEditPlayer(null)}
                >
                    <PlayerForm
                        form={editForm}
                        teams={teams}
                        showIsActive={true}
                        isActive={editForm.isActive}
                        onChange={(f) => setEditForm(f as UpdateRosterPlayerDto)}
                        onSubmit={(e) => void handleEdit(e)}
                        onCancel={() => setEditPlayer(null)}
                    />
                </Modal>
            )}

            {/* CSV import modal */}
            {showCsvModal && (
                <Modal title="Import CSV" onClose={() => setShowCsvModal(false)}>
                    <form onSubmit={(e) => void handleCsvImport(e)}>
                        <p className="text-xs text-text-muted mb-2">
                            Format: <code>FirstName,Surname,Position,TeamShortName</code>
                        </p>
                        <label htmlFor="csv-content" className="label">
                            CSV Content
                        </label>
                        <textarea
                            id="csv-content"
                            rows={6}
                            className="w-full bg-border border border-border rounded px-3 py-2 mb-4 text-white text-xs font-mono"
                            value={csvContent}
                            onChange={(e) => setCsvContent(e.target.value)}
                            required
                        />
                        <div className="flex gap-2 justify-end">
                            <button
                                type="button"
                                onClick={() => setShowCsvModal(false)}
                                className="btn-ghost text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover rounded"
                            >
                                Import
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Copy from season modal */}
            {showCopyModal && (
                <Modal title="Copy Roster from Season" onClose={() => setShowCopyModal(false)}>
                    <form onSubmit={(e) => void handleCopyFromSeason(e)}>
                        <label
                            htmlFor="copy-source-season"
                            className="label"
                        >
                            Source Season
                        </label>
                        <select
                            id="copy-source-season"
                            value={copySourceId}
                            onChange={(e) =>
                                setCopySourceId(e.target.value === '' ? '' : Number(e.target.value))
                            }
                            className="w-full bg-border border border-border rounded px-3 py-2 mb-4 text-white"
                            required
                        >
                            <option value="">Select season…</option>
                            {seasons
                                .filter((s) => s.id !== selectedSeasonId)
                                .map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name}
                                    </option>
                                ))}
                        </select>
                        <div className="flex gap-2 justify-end">
                            <button
                                type="button"
                                onClick={() => setShowCopyModal(false)}
                                className="btn-ghost text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover rounded"
                            >
                                Copy
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    )
}

// ---- Extracted player form ----

interface PlayerFormFields {
    firstName: string
    surname: string
    position?: string | null
    teamId: number
    isActive?: boolean
}

interface PlayerFormProps {
    form: PlayerFormFields
    teams: Team[]
    showIsActive: boolean
    isActive: boolean
    onChange: (f: PlayerFormFields) => void
    onSubmit: (e: React.FormEvent) => void
    onCancel: () => void
}

function PlayerForm({ form, teams, showIsActive, isActive, onChange, onSubmit, onCancel }: PlayerFormProps) {
    const set = (patch: Partial<PlayerFormFields>) => onChange({ ...form, ...patch })

    return (
        <form onSubmit={onSubmit}>
            <label htmlFor="player-first-name" className="label">
                First Name
            </label>
            <input
                id="player-first-name"
                className="w-full bg-border border border-border rounded px-3 py-2 mb-3 text-white"
                value={form.firstName}
                onChange={(e) => set({ firstName: e.target.value })}
                required
            />

            <label htmlFor="player-surname" className="label">
                Surname
            </label>
            <input
                id="player-surname"
                className="w-full bg-border border border-border rounded px-3 py-2 mb-3 text-white"
                value={form.surname}
                onChange={(e) => set({ surname: e.target.value })}
                required
            />

            <label htmlFor="player-position" className="label">
                Position
            </label>
            <input
                id="player-position"
                className="w-full bg-border border border-border rounded px-3 py-2 mb-3 text-white"
                value={form.position ?? ''}
                onChange={(e) => set({ position: e.target.value || null })}
                placeholder="C, LW, RW, D, G"
            />

            <label htmlFor="player-team" className="label">
                Team
            </label>
            <select
                id="player-team"
                className="w-full bg-border border border-border rounded px-3 py-2 mb-3 text-white"
                value={form.teamId || ''}
                onChange={(e) => set({ teamId: Number(e.target.value) })}
                required
            >
                <option value="">Select team…</option>
                {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                        {t.name} ({t.shortName})
                    </option>
                ))}
            </select>

            {showIsActive && (
                <label className="flex items-center gap-2 mb-4 text-sm text-text cursor-pointer">
                    <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => set({ isActive: e.target.checked })}
                        className="accent-[var(--color-primary)]"
                    />
                    Active
                </label>
            )}

            <div className="flex gap-2 justify-end">
                <button type="button" onClick={onCancel} className="btn-ghost text-sm">
                    Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover rounded">
                    Save
                </button>
            </div>
        </form>
    )
}
