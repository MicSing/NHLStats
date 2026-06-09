import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Plus, DownloadSimpleIcon, UsersThreeIcon } from '@phosphor-icons/react'
import { CompletionType } from '../../types/match'
import type { Match, CreateMatchDto, UpdateMatchDto } from '../../types/match'
import type { Team } from '../../types/team'
import type { User } from '../../types/user'
import apiClient from '../../services/apiClient'
import { useToast } from '../../context/ToastContext'
import Modal from '../Modal'
import CsvColumnSelectorModal from '../CsvColumnSelectorModal'
import type { ColumnDef } from '../CsvColumnSelectorModal'
import SearchInput from '../SearchInput'
import Pagination from '../Pagination'
import CompletionBadge from '../CompletionBadge'
import LoadingSpinner from '../LoadingSpinner'
import useTable from '../../hooks/useTable'
import { TableCard, TableHead, ActionCell, PrimaryButton, SecondaryButton } from './SeasonPrimitives'
import { normalizeCompletionType } from './seasonUtils'
import BulkMatchCreator from './BulkMatchCreator'
import { CreateMatchForm, EditMatchForm } from './MatchForms'

export interface MatchesTabProps {
    seasonId: number
    teams: Team[]
    seasonUsers: User[]
}

export default function MatchesTab({ seasonId, teams, seasonUsers }: MatchesTabProps) {
    const { t } = useTranslation()
    const toast = useToast()
    const [matches, setMatches] = useState<Match[]>([])
    const [loading, setLoading] = useState(false)
    const [showAddModal, setShowAddModal] = useState(false)
    const [editMatch, setEditMatch] = useState<Match | null>(null)
    const [showBulkModal, setShowBulkModal] = useState(false)
    const [showExportModal, setShowExportModal] = useState(false)
    const [initializingAll, setInitializingAll] = useState(false)
    const [createForm, setCreateForm] = useState<CreateMatchDto>({ homeTeamId: 0, awayTeamId: 0 })
    const [editForm, setEditForm] = useState<UpdateMatchDto>({
        homeTeamId: 0,
        awayTeamId: 0,
        matchDate: null,
        homeScore: 0,
        awayScore: 0,
        completionType: CompletionType.None,
    })

    const { pageItems, totalFiltered, search, setSearch, currentPage, setCurrentPage } = useTable({
        data: matches,
        searchFields: (m) => [m.homeTeamName ?? '', m.awayTeamName ?? ''],
    })

    const loadMatches = async (id: number) => {
        setLoading(true)
        try {
            const data = await apiClient.get<Match[]>(`/api/seasons/${id}/matches`)
            setMatches(data)
        } catch {
            // silently fail
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void loadMatches(seasonId)
    }, [seasonId])

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            await apiClient.post<Match>(`/api/seasons/${seasonId}/matches`, createForm)
            setShowAddModal(false)
            setCreateForm({ homeTeamId: 0, awayTeamId: 0 })
            toast.success(t('toast.createSuccess'))
            await loadMatches(seasonId)
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    const openEdit = (m: Match) => {
        setEditMatch(m)
        setEditForm({
            homeTeamId: m.homeTeamId,
            awayTeamId: m.awayTeamId,
            matchDate: m.matchDate,
            homeScore: m.homeScore,
            awayScore: m.awayScore,
            completionType: normalizeCompletionType(m.completionType),
        })
    }

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editMatch) return
        try {
            await apiClient.put<Match>(
                `/api/seasons/${seasonId}/matches/${editMatch.id}`,
                editForm,
            )
            setEditMatch(null)
            toast.success(t('toast.saveSuccess'))
            await loadMatches(seasonId)
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    const exportColumnDefs: ColumnDef[] = [
        { key: 'match', label: t('csvExport.columns.match'), defaultSelected: true, required: true },
        { key: 'details', label: t('csvExport.columns.details'), defaultSelected: true },
    ]

    const completionTypeToken = (ct: CompletionType): string => {
        switch (normalizeCompletionType(ct)) {
            case CompletionType.RegularTime: return 'REG'
            case CompletionType.Overtime: return 'OT'
            case CompletionType.Shootout: return 'SO'
            default: return 'NONE'
        }
    }

    const handleExport = (selectedKeys: string[]) => {
        const shortMap = new Map(teams.map((t) => [t.id, t.shortName]))
        const includeDetails = selectedKeys.includes('details')

        const commentHeader = includeDetails
            ? '# Match, Score, Type, Date'
            : '# Match'

        const rows = matches.map((m) => {
            const away = shortMap.get(m.awayTeamId) ?? String(m.awayTeamId)
            const home = shortMap.get(m.homeTeamId) ?? String(m.homeTeamId)
            const base = `${away} @ ${home}`

            if (includeDetails && m.matchDate != null) {
                const d = new Date(m.matchDate)
                const date = `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`
                return `${base}, ${m.homeScore}:${m.awayScore}, ${completionTypeToken(m.completionType)}, ${date}`
            }
            return base
        })

        const csv = [commentHeader, ...rows].join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `matches-season-${seasonId}.csv`
        a.click()
        URL.revokeObjectURL(url)
        setShowExportModal(false)
    }

    const handleDelete = async (id: number) => {
        if (!window.confirm(t('admin.matches.deleteConfirm'))) return
        try {
            await apiClient.delete(`/api/seasons/${seasonId}/matches/${id}`)
            toast.success(t('toast.deleteSuccess'))
            await loadMatches(seasonId)
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    const handleInitializeAll = async () => {
        if (!window.confirm(t('admin.matches.initializeAllConfirm'))) return
        setInitializingAll(true)
        try {
            const { created } = await apiClient.post<{ created: number }>(
                `/api/seasons/${seasonId}/matches/usermatches/initialize-all`,
                {},
            )
            if (created > 0) {
                toast.success(t('admin.matches.initializeAllSuccess', { count: created }))
            } else {
                toast.success(t('admin.matches.initializeAllNone'))
            }
        } catch {
            toast.error(t('toast.operationFailed'))
        } finally {
            setInitializingAll(false)
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{t('admin.matches.title')}</h2>
                <div className="flex gap-2">
                    <SecondaryButton
                        icon={<DownloadSimpleIcon size={16} />}
                        label={t('admin.matches.exportCsv')}
                        onClick={() => setShowExportModal(true)}
                    />
                    <SecondaryButton
                        icon={<UsersThreeIcon size={16} />}
                        label={t('admin.matches.initializeAll')}
                        onClick={() => void handleInitializeAll()}
                        disabled={initializingAll}
                    />
                    <SecondaryButton
                        label={t('admin.matches.bulkCreate')}
                        onClick={() => setShowBulkModal(true)}
                    />
                    <PrimaryButton
                        icon={<Plus size={16} />}
                        label={t('admin.matches.newMatch')}
                        onClick={() => setShowAddModal(true)}
                    />
                </div>
            </div>

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
                                '#',
                                t('admin.matches.match'),
                                t('admin.matches.score'),
                                t('common.date'),
                                t('common.status'),
                                t('common.actions'),
                            ]}
                        />
                        <tbody className="divide-y divide-border text-sm">
                            {pageItems.map((m) => (
                                <tr
                                    key={m.id}
                                    className="hover:bg-surface/50 transition-colors group"
                                >
                                    <td className="px-4 py-3 font-mono text-text-muted w-12">
                                        {m.matchNumber}
                                    </td>
                                    <td className="px-4 py-3">
                                        <Link
                                            to={`/seasons/${seasonId}/matches/${m.id}`}
                                            className="hover:text-primary"
                                        >
                                            {m.homeTeamName} vs {m.awayTeamName}
                                        </Link>
                                    </td>
                                    <td className="px-4 py-3 font-mono">
                                        {m.matchDate
                                            ? `${m.homeScore} – ${m.awayScore}`
                                            : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-text-muted">
                                        {m.matchDate
                                            ? new Date(m.matchDate).toLocaleDateString()
                                            : t('admin.matches.tbd')}
                                    </td>
                                    <td className="px-4 py-3">
                                        <CompletionBadge type={normalizeCompletionType(m.completionType)} />
                                    </td>
                                    <ActionCell
                                        onEdit={() => openEdit(m)}
                                        onDelete={() => void handleDelete(m.id)}
                                        editTitle={t('common.edit')}
                                        deleteTitle={t('common.delete')}
                                    />
                                </tr>
                            ))}
                            {matches.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="px-4 py-8 text-center text-text-muted text-sm"
                                    >
                                        {t('admin.matches.noMatches')}
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
                    title={t('admin.matches.newMatch')}
                    onClose={() => setShowAddModal(false)}
                >
                    <CreateMatchForm
                        teams={teams}
                        form={createForm}
                        onChange={setCreateForm}
                        onSubmit={(e) => void handleCreate(e)}
                        onCancel={() => setShowAddModal(false)}
                    />
                </Modal>
            )}

            {editMatch && (
                <Modal
                    title={t('admin.matches.editMatch', { number: editMatch.matchNumber })}
                    onClose={() => setEditMatch(null)}
                >
                    <EditMatchForm
                        teams={teams}
                        form={editForm}
                        onChange={setEditForm}
                        onSubmit={(e) => void handleEdit(e)}
                        onCancel={() => setEditMatch(null)}
                    />
                </Modal>
            )}

            {showExportModal && (
                <CsvColumnSelectorModal
                    title={t('admin.matches.exportTitle')}
                    columns={exportColumnDefs}
                    confirmLabel={t('admin.matches.exportConfirm')}
                    onConfirm={handleExport}
                    onClose={() => setShowExportModal(false)}
                />
            )}

            {showBulkModal && (
                <Modal
                    title={t('admin.matches.bulkCreateTitle')}
                    onClose={() => setShowBulkModal(false)}
                >
                    <BulkMatchCreator
                        seasonId={seasonId}
                        teams={teams}
                        seasonUsers={seasonUsers}
                        onSuccess={() => {
                            setShowBulkModal(false)
                            void loadMatches(seasonId)
                        }}
                        onClose={() => setShowBulkModal(false)}
                    />
                </Modal>
            )}
        </div>
    )
}
