import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Plus, DownloadSimple } from '@phosphor-icons/react'
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
        { key: 'matchNumber', label: t('csvExport.columns.matchNumber') },
        { key: 'homeTeamName', label: t('csvExport.columns.homeTeamName') },
        { key: 'awayTeamName', label: t('csvExport.columns.awayTeamName') },
        { key: 'homeScore', label: t('csvExport.columns.homeScore') },
        { key: 'awayScore', label: t('csvExport.columns.awayScore') },
        { key: 'matchDate', label: t('csvExport.columns.matchDate') },
        { key: 'completionType', label: t('csvExport.columns.completionType') },
    ]

    const completionTypeLabel = (ct: CompletionType): string => {
        switch (ct) {
            case CompletionType.RegularTime: return t('admin.matches.regularTime')
            case CompletionType.Overtime: return t('admin.matches.overtime')
            case CompletionType.Shootout: return t('admin.matches.shootout')
            case CompletionType.InProgress: return 'In Progress'
            default: return '—'
        }
    }

    const handleExport = (selectedKeys: string[]) => {
        const escapeCsv = (val: string | number | null | undefined): string => {
            const s = val == null ? '' : String(val)
            return s.includes(',') || s.includes('"') || s.includes('\n')
                ? `"${s.replace(/"/g, '""')}"`
                : s
        }

        const header = selectedKeys
            .map((k) => exportColumnDefs.find((c) => c.key === k)?.label ?? k)
            .join(',')

        const rows = matches.map((m) => {
            const values: Record<string, string | number | null> = {
                matchNumber: m.matchNumber,
                homeTeamName: m.homeTeamName,
                awayTeamName: m.awayTeamName,
                homeScore: m.matchDate != null ? m.homeScore : null,
                awayScore: m.matchDate != null ? m.awayScore : null,
                matchDate: m.matchDate ? new Date(m.matchDate).toLocaleDateString() : null,
                completionType: completionTypeLabel(normalizeCompletionType(m.completionType)),
            }
            return selectedKeys.map((k) => escapeCsv(values[k])).join(',')
        })

        const csv = [header, ...rows].join('\n')
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

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{t('admin.matches.title')}</h2>
                <div className="flex gap-2">
                    <SecondaryButton
                        icon={<DownloadSimple size={16} />}
                        label={t('admin.matches.exportCsv')}
                        onClick={() => setShowExportModal(true)}
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
