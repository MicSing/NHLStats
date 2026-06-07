import { useEffect, useState } from 'react'
import { GearSix, Plus, CaretRight } from '@phosphor-icons/react'
import { LeagueType } from '../../types/team'
import type { Team } from '../../types/team'
import type { Season, SeasonDetail, CreateSeasonDto, SeasonStatus } from '../../types/season'
import type { User } from '../../types/user'
import apiClient from '../../services/apiClient'
import { cacheService } from '../../services/cacheService'
import Modal from '../../components/Modal'
import StatusBadge from '../../components/StatusBadge'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorMessage from '../../components/ErrorMessage'
import { useToast } from '../../context/ToastContext'
import { useTranslation } from 'react-i18next'
import { Tab } from '../../components/season/SeasonPrimitives'
import SeasonForm from '../../components/season/SeasonForm'
import InfoTab from '../../components/season/InfoTab'
import UsersTab from '../../components/season/UsersTab'
import RosterTab from '../../components/season/RosterTab'
import MatchesTab from '../../components/season/MatchesTab'
import ManualPointsTab from '../../components/season/ManualPointsTab'

type ActiveTab = 'info' | 'users' | 'roster' | 'matches' | 'points'

export default function SeasonManagementPage() {
    const { t } = useTranslation()
    const toast = useToast()
    const [seasons, setSeasons] = useState<Season[]>([])
    const [activeSeason, setActiveSeason] = useState<Season | null>(null)
    const [seasonDetail, setSeasonDetail] = useState<SeasonDetail | null>(null)
    const [teams, setTeams] = useState<Team[]>([])
    const [allUsers, setAllUsers] = useState<User[]>([])
    const [activeTab, setActiveTab] = useState<ActiveTab>('matches')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showAddModal, setShowAddModal] = useState(false)
    const [addForm, setAddForm] = useState<CreateSeasonDto>({
        name: '',
        startedOn: new Date().toISOString().split('T')[0],
        status: '',
        hostedTeamId: null,
        leagueType: LeagueType.NHL,
    })

    const resetAddForm = () =>
        setAddForm({
            name: '',
            startedOn: new Date().toISOString().split('T')[0],
            status: '',
            hostedTeamId: null,
            leagueType: LeagueType.NHL,
        })

    const loadSeasonDetail = async (id: number) => {
        try {
            const detail = await apiClient.get<SeasonDetail>(`/api/seasons/${id}`)
            setSeasonDetail(detail)
        } catch {
            setSeasonDetail(null)
        }
    }

    const loadAll = async (keepActive?: Season) => {
        try {
            const [seasonsData, teamsData, usersData] = await Promise.all([
                cacheService.getSeasons(true),
                apiClient.get<Team[]>('/api/teams'),
                cacheService.getUsers(true),
            ])
            setSeasons(seasonsData)
            setTeams(teamsData)
            setAllUsers(usersData)
            const currentActive = keepActive ?? (seasonsData.length > 0 ? seasonsData[0] : null)
            if (currentActive) {
                setActiveSeason(currentActive)
                void loadSeasonDetail(currentActive.id)
            }
        } catch {
            setError(t('errors.failedToLoadData'))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void loadAll()
    }, [])

    const handleSeasonChange = (id: number) => {
        const season = seasons.find((s) => s.id === id)
        if (!season) return
        setActiveSeason(season)
        setSeasonDetail(null)
        void loadSeasonDetail(id)
    }

    const handleSeasonUpdated = (updated: Season) => {
        setActiveSeason(updated)
        setSeasons((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
        cacheService.invalidateSeasons()
    }

    const handleSeasonDeleted = (id: number) => {
        const remaining = seasons.filter((s) => s.id !== id)
        setSeasons(remaining)
        cacheService.invalidateSeasons()
        if (remaining.length > 0) {
            const next = remaining[0]
            setActiveSeason(next)
            setSeasonDetail(null)
            void loadSeasonDetail(next.id)
        } else {
            setActiveSeason(null)
            setSeasonDetail(null)
        }
    }

    const handleRefreshDetail = () => {
        if (activeSeason) void loadSeasonDetail(activeSeason.id)
    }

    const handleAddSeason = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const created = await apiClient.post<Season>('/api/seasons', addForm)
            cacheService.invalidateSeasons()
            setShowAddModal(false)
            resetAddForm()
            toast.success(t('toast.createSuccess'))
            const updatedSeasons = await cacheService.getSeasons(true)
            setSeasons(updatedSeasons)
            setActiveSeason(created)
            setSeasonDetail(null)
            void loadSeasonDetail(created.id)
            setActiveTab('info')
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    const statusVariant = (status: SeasonStatus): 'success' | 'muted' =>
        status === 'Active' ? 'success' : 'muted'

    if (loading) return <LoadingSpinner />
    if (error) return <ErrorMessage message={error} onRetry={() => void loadAll()} />

    return (
        <div>
            {/* Header */}
            <div className="flex items-center gap-2 mb-0">
                <span className="text-text-muted text-sm">{t('nav.adminSeasons')}</span>
                <CaretRight size={14} className="text-text-muted" weight="bold" />

                {seasons.length > 0 && activeSeason ? (
                    <>
                        <select
                            value={activeSeason.id}
                            onChange={(e) => handleSeasonChange(Number(e.target.value))}
                            className="bg-transparent text-xl font-bold outline-none cursor-pointer text-text"
                        >
                            {seasons.map((s) => (
                                <option
                                    key={s.id}
                                    value={s.id}
                                    className="bg-surface text-sm font-normal text-text"
                                >
                                    {s.name}
                                </option>
                            ))}
                        </select>
                        {activeSeason.status && (
                            <StatusBadge variant={statusVariant(activeSeason.status)}>
                                {activeSeason.status}
                            </StatusBadge>
                        )}
                    </>
                ) : (
                    <span className="text-xl font-bold text-text-muted">—</span>
                )}

                <div className="w-px h-5 bg-border mx-1 shrink-0" />

                <button
                    onClick={() => setActiveTab('info')}
                    className="p-1.5 text-text-muted hover:bg-border hover:text-text rounded-md transition-colors"
                    title={t('admin.seasons.basicInformation')}
                >
                    <GearSix size={16} />
                </button>
                <button
                    onClick={() => {
                        resetAddForm()
                        setShowAddModal(true)
                    }}
                    className="p-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors"
                    title={t('admin.seasons.addSeason')}
                >
                    <Plus size={16} />
                </button>
            </div>

            {/* Tab bar */}
            <div className="flex gap-6 border-b border-border mb-6">
                <Tab
                    label={t('admin.seasons.basicInformation')}
                    active={activeTab === 'info'}
                    onClick={() => setActiveTab('info')}
                />
                <Tab
                    label={t('admin.seasons.manageUsers')}
                    active={activeTab === 'users'}
                    onClick={() => setActiveTab('users')}
                />
                <Tab
                    label={t('admin.roster.title')}
                    active={activeTab === 'roster'}
                    onClick={() => setActiveTab('roster')}
                />
                <Tab
                    label={t('admin.matches.title')}
                    active={activeTab === 'matches'}
                    onClick={() => setActiveTab('matches')}
                />
                <Tab
                    label={t('admin.aggregated.title')}
                    active={activeTab === 'points'}
                    onClick={() => setActiveTab('points')}
                />
            </div>

            {/* Content */}
            {!activeSeason ? (
                <div className="text-center py-16 text-text-muted">
                    <p className="text-sm mb-4">No seasons yet.</p>
                    <button
                        onClick={() => {
                            resetAddForm()
                            setShowAddModal(true)
                        }}
                        className="bg-primary hover:bg-primary-hover px-4 py-2 rounded text-sm font-medium"
                    >
                        {t('admin.seasons.addSeason')}
                    </button>
                </div>
            ) : (
                <>
                    {activeTab === 'info' && (
                        <InfoTab
                            key={activeSeason.id}
                            season={activeSeason}
                            teams={teams}
                            onSeasonUpdated={handleSeasonUpdated}
                            onSeasonDeleted={handleSeasonDeleted}
                        />
                    )}
                    {activeTab === 'users' && (
                        <UsersTab
                            key={activeSeason.id}
                            season={activeSeason}
                            allUsers={allUsers}
                            seasonDetail={seasonDetail}
                            onRefreshDetail={handleRefreshDetail}
                        />
                    )}
                    {activeTab === 'roster' && (
                        <RosterTab
                            seasonId={activeSeason.id}
                            teams={teams}
                            seasons={seasons}
                        />
                    )}
                    {activeTab === 'matches' && (
                        <MatchesTab
                            seasonId={activeSeason.id}
                            teams={teams}
                            seasonUsers={seasonDetail?.users ?? []}
                        />
                    )}
                    {activeTab === 'points' && (
                        <ManualPointsTab
                            seasonId={activeSeason.id}
                            seasonDetail={seasonDetail}
                        />
                    )}
                </>
            )}

            {/* Add season modal */}
            {showAddModal && (
                <Modal
                    title={t('admin.seasons.addSeason')}
                    onClose={() => setShowAddModal(false)}
                >
                    <SeasonForm
                        form={addForm}
                        teams={teams}
                        onChange={setAddForm}
                        onSubmit={(e) => void handleAddSeason(e)}
                        onCancel={() => setShowAddModal(false)}
                    />
                </Modal>
            )}
        </div>
    )
}
