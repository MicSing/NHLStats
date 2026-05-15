import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from '@phosphor-icons/react'
import type { Team } from '../../types/team'
import type { Season } from '../../types/season'
import type {
    RosterPlayer,
    CreateRosterPlayerDto,
    UpdateRosterPlayerDto,
    CsvImportResultDto,
} from '../../types/roster'
import apiClient from '../../services/apiClient'
import { useToast } from '../../context/ToastContext'
import Modal from '../Modal'
import SearchInput from '../SearchInput'
import Pagination from '../Pagination'
import StatusBadge from '../StatusBadge'
import LoadingSpinner from '../LoadingSpinner'
import useTable from '../../hooks/useTable'
import { TableCard, TableHead, ActionCell, PrimaryButton, SecondaryButton } from './SeasonPrimitives'

// ─── Player form ──────────────────────────────────────────────────────────────

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

function PlayerForm({
    form,
    teams,
    showIsActive,
    isActive,
    onChange,
    onSubmit,
    onCancel,
}: PlayerFormProps) {
    const { t } = useTranslation()
    const set = (patch: Partial<PlayerFormFields>) => onChange({ ...form, ...patch })

    return (
        <form onSubmit={onSubmit}>
            <label htmlFor="player-first-name" className="label">
                {t('admin.roster.firstName')}
            </label>
            <input
                id="player-first-name"
                className="w-full bg-border border border-border rounded px-3 py-2 mb-3 text-white"
                value={form.firstName}
                onChange={(e) => set({ firstName: e.target.value })}
                required
            />

            <label htmlFor="player-surname" className="label">
                {t('admin.roster.surname')}
            </label>
            <input
                id="player-surname"
                className="w-full bg-border border border-border rounded px-3 py-2 mb-3 text-white"
                value={form.surname}
                onChange={(e) => set({ surname: e.target.value })}
                required
            />

            <label htmlFor="player-position" className="label">
                {t('admin.roster.position')}
            </label>
            <input
                id="player-position"
                className="w-full bg-border border border-border rounded px-3 py-2 mb-3 text-white"
                value={form.position ?? ''}
                onChange={(e) => set({ position: e.target.value || null })}
                placeholder={t('admin.roster.positionPlaceholder')}
            />

            <label htmlFor="player-team" className="label">
                {t('admin.roster.team')}
            </label>
            <select
                id="player-team"
                className="w-full bg-border border border-border rounded px-3 py-2 mb-3 text-white"
                value={form.teamId || ''}
                onChange={(e) => set({ teamId: Number(e.target.value) })}
                required
            >
                <option value="">{t('common.select')}</option>
                {teams.map((tm) => (
                    <option key={tm.id} value={tm.id}>
                        {tm.name} ({tm.shortName})
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
                    {t('common.active')}
                </label>
            )}

            <div className="flex gap-2 justify-end">
                <button type="button" onClick={onCancel} className="btn-ghost text-sm">
                    {t('common.cancel')}
                </button>
                <button type="submit" className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover rounded">
                    {t('common.save')}
                </button>
            </div>
        </form>
    )
}

// ─── Roster tab ───────────────────────────────────────────────────────────────

export interface RosterTabProps {
    seasonId: number
    teams: Team[]
    seasons: Season[]
}

export default function RosterTab({ seasonId, teams, seasons }: RosterTabProps) {
    const { t } = useTranslation()
    const toast = useToast()
    const [players, setPlayers] = useState<RosterPlayer[]>([])
    const [loading, setLoading] = useState(false)
    const [showAddModal, setShowAddModal] = useState(false)
    const [addForm, setAddForm] = useState<CreateRosterPlayerDto>({
        firstName: '',
        surname: '',
        position: '',
        teamId: 0,
    })
    const [editPlayer, setEditPlayer] = useState<RosterPlayer | null>(null)
    const [editForm, setEditForm] = useState<UpdateRosterPlayerDto>({
        firstName: '',
        surname: '',
        position: '',
        teamId: 0,
        isActive: true,
    })
    const [csvContent, setCsvContent] = useState('')
    const [csvResult, setCsvResult] = useState<CsvImportResultDto | null>(null)
    const [showCsvModal, setShowCsvModal] = useState(false)
    const [showCopyModal, setShowCopyModal] = useState(false)
    const [copySourceId, setCopySourceId] = useState<number | ''>('')

    const { pageItems, totalFiltered, search, setSearch, currentPage, setCurrentPage } = useTable({
        data: players,
        searchFields: (p) => [p.firstName, p.surname, p.teamShortName ?? ''],
    })

    const loadPlayers = async (id: number) => {
        setLoading(true)
        try {
            const data = await apiClient.get<RosterPlayer[]>(`/api/seasons/${id}/roster`)
            setPlayers(data)
        } catch {
            // silently fail — error shown via toast if mutation fails
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void loadPlayers(seasonId)
        setCsvResult(null)
    }, [seasonId])

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            await apiClient.post<RosterPlayer>(`/api/seasons/${seasonId}/roster`, addForm)
            setShowAddModal(false)
            setAddForm({ firstName: '', surname: '', position: '', teamId: 0 })
            toast.success(t('toast.createSuccess'))
            await loadPlayers(seasonId)
        } catch {
            toast.error(t('toast.operationFailed'))
        }
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
        if (!editPlayer) return
        try {
            await apiClient.put<RosterPlayer>(
                `/api/seasons/${seasonId}/roster/${editPlayer.id}`,
                editForm,
            )
            setEditPlayer(null)
            toast.success(t('toast.saveSuccess'))
            await loadPlayers(seasonId)
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    const handleDelete = async (playerId: number) => {
        try {
            await apiClient.delete(`/api/seasons/${seasonId}/roster/${playerId}`)
            toast.success(t('toast.deleteSuccess'))
            await loadPlayers(seasonId)
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    const handleCsvImport = async (e: React.FormEvent) => {
        e.preventDefault()
        const result = await apiClient.post<CsvImportResultDto>(
            `/api/seasons/${seasonId}/roster/import`,
            { csvContent },
        )
        setCsvResult(result)
        setCsvContent('')
        setShowCsvModal(false)
        await loadPlayers(seasonId)
    }

    const handleCopyFromSeason = async (e: React.FormEvent) => {
        e.preventDefault()
        if (copySourceId === '') return
        await apiClient.post<RosterPlayer[]>(
            `/api/seasons/${seasonId}/roster/copy/${copySourceId}`,
            {},
        )
        setShowCopyModal(false)
        setCopySourceId('')
        await loadPlayers(seasonId)
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{t('admin.roster.title')}</h2>
                <div className="flex gap-2">
                    <SecondaryButton
                        label={t('admin.roster.importCsv')}
                        onClick={() => setShowCsvModal(true)}
                    />
                    <SecondaryButton
                        label={t('admin.roster.copyFromSeason')}
                        onClick={() => setShowCopyModal(true)}
                    />
                    <PrimaryButton
                        icon={<Plus size={16} />}
                        label={t('admin.roster.addPlayer')}
                        onClick={() => setShowAddModal(true)}
                    />
                </div>
            </div>

            {csvResult && (
                <p className="text-sm text-success">
                    {t('admin.roster.importedCount', { count: csvResult.imported })}
                    {csvResult.errors.length > 0 && (
                        <span className="text-warning"> {csvResult.errors.join('; ')}</span>
                    )}
                </p>
            )}

            {loading ? (
                <LoadingSpinner size="sm" inline />
            ) : (
                <>
                    <SearchInput
                        value={search}
                        onChange={setSearch}
                        placeholder={t('common.search')}
                    />
                    <TableCard>
                        <TableHead
                            columns={[
                                t('common.name'),
                                t('admin.roster.position'),
                                t('admin.roster.team'),
                                t('common.status'),
                                t('common.actions'),
                            ]}
                        />
                        <tbody className="divide-y divide-border text-sm">
                            {pageItems.map((p) => (
                                <tr
                                    key={p.id}
                                    className="hover:bg-surface/50 transition-colors group"
                                >
                                    <td className="px-4 py-3 font-medium">
                                        {p.firstName} {p.surname}
                                    </td>
                                    <td className="px-4 py-3 text-text-muted">{p.position ?? '—'}</td>
                                    <td className="px-4 py-3 text-text-muted">{p.teamShortName}</td>
                                    <td className="px-4 py-3">
                                        <StatusBadge variant={p.isActive ? 'success' : 'muted'}>
                                            {p.isActive ? t('common.active') : t('common.inactive')}
                                        </StatusBadge>
                                    </td>
                                    <ActionCell
                                        onEdit={() => openEdit(p)}
                                        onDelete={() => void handleDelete(p.id)}
                                        editTitle={t('common.edit')}
                                        deleteTitle={t('common.delete')}
                                    />
                                </tr>
                            ))}
                            {players.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="px-4 py-8 text-center text-text-muted text-sm"
                                    >
                                        No players in this season yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </TableCard>
                    <Pagination
                        currentPage={currentPage}
                        totalItems={totalFiltered}
                        pageSize={20}
                        onPageChange={setCurrentPage}
                    />
                </>
            )}

            {showAddModal && (
                <Modal
                    title={t('admin.roster.addPlayer')}
                    onClose={() => setShowAddModal(false)}
                >
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

            {editPlayer && (
                <Modal
                    title={t('admin.roster.editPlayer', {
                        name: `${editPlayer.firstName} ${editPlayer.surname}`,
                    })}
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

            {showCsvModal && (
                <Modal
                    title={t('admin.roster.importCsv')}
                    onClose={() => setShowCsvModal(false)}
                >
                    <form onSubmit={(e) => void handleCsvImport(e)}>
                        <p className="text-xs text-text-muted mb-2">
                            {t('admin.roster.csvFormat')}
                        </p>
                        <label htmlFor="csv-content" className="label">
                            {t('admin.roster.csvContent')}
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
                                {t('common.cancel')}
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover rounded"
                            >
                                {t('common.import')}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {showCopyModal && (
                <Modal
                    title={t('admin.roster.copyFromSeason')}
                    onClose={() => setShowCopyModal(false)}
                >
                    <form onSubmit={(e) => void handleCopyFromSeason(e)}>
                        <label htmlFor="copy-source-season" className="label">
                            {t('admin.roster.sourceSeason')}
                        </label>
                        <select
                            id="copy-source-season"
                            value={copySourceId}
                            onChange={(e) =>
                                setCopySourceId(
                                    e.target.value === '' ? '' : Number(e.target.value),
                                )
                            }
                            className="w-full bg-border border border-border rounded px-3 py-2 mb-4 text-white"
                            required
                        >
                            <option value="">{t('admin.roster.selectSourceSeason')}</option>
                            {seasons
                                .filter((s) => s.id !== seasonId)
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
                                {t('common.cancel')}
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover rounded"
                            >
                                {t('common.copy')}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    )
}
