import { useState } from 'react'
import { TrashIcon, XIcon, PlusIcon } from '@phosphor-icons/react'
import type {
    UserMatch,
    UserMatchPoint,
    UserMatchGoal,
    UserMatchPenalty,
    CreateUserMatchPointDto,
    CreateUserMatchGoalDto,
    CreateUserMatchPenaltyDto,
    GoalType,
} from '../types/userMatch'
import type { RosterPlayer } from '../types/roster'
import type { PointReason, PointType } from '../types/pointReason'
import apiClient from '../services/apiClient'
import SearchableSelect from './SearchableSelect'
import Modal from './Modal'
import { useTranslation } from 'react-i18next'
import { useToast } from '../context/ToastContext'

type Tab = 'goals' | 'penalties' | 'points'

interface GoalModal {
    goalType: GoalType
    pointRecipientUserMatchId: number | ''
    pointReasonId: number | ''
}

interface Props {
    userMatch: UserMatch
    points: UserMatchPoint[]
    goals: UserMatchGoal[]
    penalties: UserMatchPenalty[]
    roster: RosterPlayer[]
    pointReasons: PointReason[]
    allUserMatches: UserMatch[]
    isAuth: boolean
    onChanged: () => void
    onGoalAdded?: () => Promise<void>
    onNegativePointAdded?: (pointReasonId: number) => Promise<void>
}

export default function UserMatchCard({
    userMatch: um,
    points,
    goals,
    penalties,
    roster,
    pointReasons,
    allUserMatches,
    isAuth,
    onChanged,
    onGoalAdded,
    onNegativePointAdded,
}: Props) {
    const { t } = useTranslation()
    const toast = useToast()
    const [activeTab, setActiveTab] = useState<Tab>('goals')

    const [goalForm, setGoalForm] = useState<{ rosterPlayerId: number | ''; count: number }>({
        rosterPlayerId: '',
        count: 1,
    })
    const [penaltyForm, setPenaltyForm] = useState<{ rosterPlayerId: number | ''; count: number }>({
        rosterPlayerId: '',
        count: 1,
    })
    const [pointForm, setPointForm] = useState<{ pointType: PointType; pointReasonId: number | ''; count: number }>({
        pointType: 'Positive',
        pointReasonId: '',
        count: 1,
    })
    const [goalModal, setGoalModal] = useState<GoalModal | null>(null)

    const positiveReasons = pointReasons.filter((r) => r.pointType === 'Positive')
    const negativeReasons = pointReasons.filter((r) => r.pointType === 'Negative')
    const neutralReasons = pointReasons.filter((r) => r.pointType === 'Neutral')

    const totalPlus = points.filter((p) => p.pointType === 'Positive').reduce((sum, p) => sum + p.count, 0)
    const totalMinus = points.filter((p) => p.pointType === 'Negative').reduce((sum, p) => sum + p.count, 0)
    const totalNeutral = points.filter((p) => p.pointType === 'Neutral').reduce((sum, p) => sum + p.count, 0)

    const reasonsForType: Record<PointType, PointReason[]> = {
        Positive: positiveReasons,
        Negative: negativeReasons,
        Neutral: neutralReasons,
    }

    const handlePointTypeChange = (type: PointType) => {
        setPointForm({ pointType: type, pointReasonId: '', count: 1 })
    }

    const handleAddPoint = async (reasonId: number | '', count: number) => {
        if (reasonId === '') return
        await apiClient.post<UserMatchPoint>(`/api/usermatches/${um.id}/points`, {
            pointReasonId: reasonId,
            count,
        } as CreateUserMatchPointDto)
        const reason = pointReasons.find((r) => r.id === reasonId)
        if (reason?.pointType === 'Negative') {
            await onNegativePointAdded?.(reasonId as number)
        }
        onChanged()
    }

    const handleDeletePointsByReason = async (ids: number[]) => {
        for (const id of ids) {
            await apiClient.delete(`/api/usermatches/${um.id}/points/${id}`)
        }
        onChanged()
    }

    const handleAddGoal = async (goalType: GoalType = 'Regular') => {
        if (goalForm.rosterPlayerId === '') return
        await apiClient.post<UserMatchGoal>(`/api/usermatches/${um.id}/goals`, {
            rosterPlayerId: goalForm.rosterPlayerId,
            count: goalForm.count,
            goalType,
        } as CreateUserMatchGoalDto)
        await onGoalAdded?.()
        onChanged()
    }

    const handleOpenGoalModal = (goalType: GoalType) => {
        const activePositiveReasons = positiveReasons.filter((r) => r.isActive)
        const activeNeutralReasons = neutralReasons.filter((r) => r.isActive)
        const preselectedReason =
            goalType === 'PowerPlay'
                ? (activePositiveReasons.find((r) => r.name === 'Penalty')?.id ??
                    (activePositiveReasons.length === 1 ? activePositiveReasons[0].id : ''))
                : (activeNeutralReasons.find((r) => r.name === 'Shorthanded Goal')?.id ??
                    (activeNeutralReasons.length === 1 ? activeNeutralReasons[0].id : ''))
        setGoalModal({ goalType, pointRecipientUserMatchId: '', pointReasonId: preselectedReason })
    }

    const handleGoalModalConfirm = async () => {
        if (!goalModal || goalModal.pointRecipientUserMatchId === '' || goalModal.pointReasonId === '') return
        if (goalForm.rosterPlayerId === '') return
        try {
            await apiClient.post(`/api/usermatches/${goalModal.pointRecipientUserMatchId}/points`, {
                pointReasonId: goalModal.pointReasonId,
                count: 1,
            } as CreateUserMatchPointDto)
            await apiClient.post(`/api/usermatches/${um.id}/goals`, {
                rosterPlayerId: goalForm.rosterPlayerId,
                count: 1,
                goalType: goalModal.goalType,
            } as CreateUserMatchGoalDto)
            await onGoalAdded?.()
            setGoalModal(null)
            onChanged()
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    const handleDeleteGoal = async (goalIds: number[]) => {
        for (const id of goalIds) {
            await apiClient.delete(`/api/usermatches/${um.id}/goals/${id}`)
        }
        onChanged()
    }

    const handleAddPenalty = async () => {
        if (penaltyForm.rosterPlayerId === '') return
        await apiClient.post<UserMatchPenalty>(`/api/usermatches/${um.id}/penalties`, {
            rosterPlayerId: penaltyForm.rosterPlayerId,
            count: penaltyForm.count,
        } as CreateUserMatchPenaltyDto)
        onChanged()
    }

    const handleDeletePenalty = async (penaltyIds: number[]) => {
        for (const id of penaltyIds) {
            await apiClient.delete(`/api/usermatches/${um.id}/penalties/${id}`)
        }
        onChanged()
    }

    const handleDeleteUserMatch = async () => {
        if (!window.confirm(t('userMatchCard.deleteConfirm', { userName: um.userName }))) return
        try {
            await apiClient.delete(`/api/usermatches/${um.id}`)
            toast.success(t('toast.deleteSuccess'))
            onChanged()
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    const tabClass = (tab: Tab) =>
        `px-4 py-3 text-sm font-medium transition-colors border-b-2 capitalize ${
            activeTab === tab
                ? 'border-primary text-text'
                : 'border-transparent text-text-muted hover:text-text'
        }`

    // Aggregate goals by player+type
    type GoalGroup = {
        rosterPlayerId: number
        firstName: string | null
        surname: string | null
        totalCount: number
        ids: number[]
        goalType: GoalType
    }
    const goalGroups = Object.values(
        goals.reduce<Record<string, GoalGroup>>((acc, g) => {
            const key = `${g.rosterPlayerId}-${g.goalType}`
            if (acc[key]) {
                acc[key].totalCount += g.count
                acc[key].ids.push(g.id)
            } else {
                acc[key] = {
                    rosterPlayerId: g.rosterPlayerId,
                    firstName: g.playerFirstName,
                    surname: g.playerSurname,
                    totalCount: g.count,
                    ids: [g.id],
                    goalType: g.goalType,
                }
            }
            return acc
        }, {}),
    )

    // Aggregate penalties by player
    type PenaltyGroup = {
        rosterPlayerId: number
        firstName: string | null
        surname: string | null
        totalCount: number
        ids: number[]
    }
    const penaltyGroups = Object.values(
        penalties.reduce<Record<number, PenaltyGroup>>((acc, p) => {
            if (acc[p.rosterPlayerId]) {
                acc[p.rosterPlayerId].totalCount += p.count
                acc[p.rosterPlayerId].ids.push(p.id)
            } else {
                acc[p.rosterPlayerId] = {
                    rosterPlayerId: p.rosterPlayerId,
                    firstName: p.playerFirstName,
                    surname: p.playerSurname,
                    totalCount: p.count,
                    ids: [p.id],
                }
            }
            return acc
        }, {}),
    )

    // Aggregate points by reason
    type PointGroup = {
        pointReasonId: number
        pointReasonName: string | null
        pointType: PointType
        totalCount: number
        ids: number[]
    }
    const pointGroups = Object.values(
        points.reduce<Record<number, PointGroup>>((acc, p) => {
            if (acc[p.pointReasonId]) {
                acc[p.pointReasonId].totalCount += p.count
                acc[p.pointReasonId].ids.push(p.id)
            } else {
                acc[p.pointReasonId] = {
                    pointReasonId: p.pointReasonId,
                    pointReasonName: p.pointReasonName,
                    pointType: p.pointType,
                    totalCount: p.count,
                    ids: [p.id],
                }
            }
            return acc
        }, {}),
    )

    const totalGoals = goals.reduce((s, g) => s + g.count, 0)
    const totalPenalties = penalties.reduce((s, p) => s + p.count, 0)
    const totalPoints = points.reduce((s, p) => s + p.count, 0)

    const pointTypeButtonClass = (type: PointType) => {
        const isActive = pointForm.pointType === type
        if (type === 'Positive') {
            return `flex-1 py-1.5 text-sm rounded-md border transition-colors ${
                isActive
                    ? 'bg-success/20 text-success border-success/50'
                    : 'border-transparent text-text-muted hover:bg-border'
            }`
        }
        if (type === 'Negative') {
            return `flex-1 py-1.5 text-sm rounded-md border transition-colors ${
                isActive
                    ? 'bg-danger/20 text-danger border-danger/50'
                    : 'border-transparent text-text-muted hover:bg-border'
            }`
        }
        return `flex-1 py-1.5 text-sm rounded-md border transition-colors ${
            isActive
                ? 'bg-border text-text border-border'
                : 'border-transparent text-text-muted hover:bg-border'
        }`
    }

    const addPointButtonClass = () => {
        if (pointForm.pointType === 'Positive') return 'btn-primary bg-success hover:bg-success/80 text-sm px-4 py-2'
        if (pointForm.pointType === 'Negative') return 'btn-danger text-sm px-4 py-2'
        return 'btn-ghost border border-border text-sm px-4 py-2'
    }

    return (
        <div id={`user-${um.id}`} className="card overflow-hidden scroll-mt-40">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <h2 className="text-lg font-semibold">{um.userName}</h2>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm bg-bg px-3 py-1 rounded-full border border-border">
                        <span className="text-success font-semibold">+{totalPlus}</span>
                        <span className="text-border">|</span>
                        <span className="text-danger font-semibold">−{totalMinus}</span>
                        {totalNeutral > 0 && (
                            <>
                                <span className="text-border">|</span>
                                <span className="text-text-muted font-semibold">○{totalNeutral}</span>
                            </>
                        )}
                    </div>
                    {isAuth && (
                        <button
                            onClick={() => void handleDeleteUserMatch()}
                            aria-label={t('userMatchCard.deleteUserMatch')}
                            className="p-2 text-text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                        >
                            <TrashIcon size={18} />
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex px-1 border-b border-border bg-surface/30">
                <button className={tabClass('goals')} onClick={() => setActiveTab('goals')}>
                    {t('userMatchCard.goals')} ({totalGoals})
                </button>
                <button className={tabClass('penalties')} onClick={() => setActiveTab('penalties')}>
                    {t('userMatchCard.penalties')} ({totalPenalties})
                </button>
                <button className={tabClass('points')} onClick={() => setActiveTab('points')}>
                    {t('userMatchCard.points')} ({totalPoints})
                </button>
            </div>

            {/* Tab content */}
            <div className="p-5">
                {/* Goals tab */}
                {activeTab === 'goals' && (
                    <div>
                        {goalGroups.length === 0 ? (
                            <p className="text-text-muted text-sm italic mb-4">
                                No {t('userMatchCard.goals').toLowerCase()} recorded yet.
                            </p>
                        ) : (
                            <div className="flex flex-wrap gap-2 mb-4">
                                {goalGroups.map((g) => (
                                    <span
                                        key={`${g.rosterPlayerId}-${g.goalType}`}
                                        className="flex items-center gap-1.5 bg-border rounded-full px-3 py-1.5 text-sm"
                                    >
                                        {g.firstName} {g.surname}
                                        {g.goalType !== 'Regular' && (
                                            <span className="text-xs font-bold text-primary ml-0.5">
                                                {g.goalType === 'PowerPlay' ? 'PP' : 'SH'}
                                            </span>
                                        )}
                                        <span className="text-text-muted mx-0.5">·</span>
                                        <span>{g.totalCount}</span>
                                        {isAuth && (
                                            <button
                                                aria-label={`delete goal for player ${g.rosterPlayerId}`}
                                                onClick={() => void handleDeleteGoal(g.ids)}
                                                className="ml-0.5 text-text-muted hover:text-danger transition-colors"
                                            >
                                                <XIcon size={13} />
                                            </button>
                                        )}
                                    </span>
                                ))}
                            </div>
                        )}
                        {isAuth && (
                            <div className="flex flex-wrap items-center gap-3 bg-bg/50 p-4 rounded-lg border border-border">
                                <SearchableSelect
                                    options={roster.map((r) => ({
                                        value: r.id,
                                        label: `${r.firstName} ${r.surname}`,
                                    }))}
                                    value={goalForm.rosterPlayerId}
                                    onChange={(v) =>
                                        setGoalForm((prev) => ({
                                            ...prev,
                                            rosterPlayerId: v === '' ? '' : Number(v),
                                        }))
                                    }
                                    placeholder={t('userMatchCard.selectPlayer')}
                                />
                                <input
                                    type="number"
                                    aria-label={t('userMatchCard.goalCount')}
                                    min={1}
                                    value={goalForm.count}
                                    onChange={(e) =>
                                        setGoalForm((prev) => ({ ...prev, count: Number(e.target.value) }))
                                    }
                                    className="input w-16 text-center text-sm py-1"
                                />
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        className="btn-primary flex items-center gap-1.5 text-sm px-3 py-1.5"
                                        onClick={() => void handleAddGoal('Regular')}
                                    >
                                        <PlusIcon size={15} weight="bold" />
                                        {t('userMatchCard.addGoal')}
                                    </button>
                                    <button
                                        type="button"
                                        className="bg-border hover:bg-border/70 text-primary border border-border text-sm px-3 py-1.5 rounded-lg font-medium transition-colors"
                                        onClick={() => handleOpenGoalModal('PowerPlay')}
                                    >
                                        {t('userMatchCard.addGoalPP')}
                                    </button>
                                    <button
                                        type="button"
                                        className="bg-border hover:bg-border/70 text-primary border border-border text-sm px-3 py-1.5 rounded-lg font-medium transition-colors"
                                        onClick={() => handleOpenGoalModal('ShortHanded')}
                                    >
                                        {t('userMatchCard.addGoalSH')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Penalties tab */}
                {activeTab === 'penalties' && (
                    <div>
                        {penaltyGroups.length === 0 ? (
                            <p className="text-text-muted text-sm italic mb-4">
                                No {t('userMatchCard.penalties').toLowerCase()} recorded yet.
                            </p>
                        ) : (
                            <div className="flex flex-wrap gap-2 mb-4">
                                {penaltyGroups.map((p) => (
                                    <span
                                        key={p.rosterPlayerId}
                                        className="flex items-center gap-1.5 bg-border rounded-full px-3 py-1.5 text-sm"
                                    >
                                        {p.firstName} {p.surname}
                                        <span className="text-text-muted mx-0.5">·</span>
                                        <span>{p.totalCount}</span>
                                        {isAuth && (
                                            <button
                                                aria-label={`delete penalty for player ${p.rosterPlayerId}`}
                                                onClick={() => void handleDeletePenalty(p.ids)}
                                                className="ml-0.5 text-text-muted hover:text-danger transition-colors"
                                            >
                                                <XIcon size={13} />
                                            </button>
                                        )}
                                    </span>
                                ))}
                            </div>
                        )}
                        {isAuth && (
                            <div className="flex flex-wrap items-center gap-3 bg-bg/50 p-4 rounded-lg border border-border">
                                <SearchableSelect
                                    options={roster.map((r) => ({
                                        value: r.id,
                                        label: `${r.firstName} ${r.surname}`,
                                    }))}
                                    value={penaltyForm.rosterPlayerId}
                                    onChange={(v) =>
                                        setPenaltyForm((prev) => ({
                                            ...prev,
                                            rosterPlayerId: v === '' ? '' : Number(v),
                                        }))
                                    }
                                    placeholder={t('userMatchCard.selectPlayer')}
                                />
                                <input
                                    type="number"
                                    aria-label={t('userMatchCard.penaltyCount')}
                                    min={1}
                                    value={penaltyForm.count}
                                    onChange={(e) =>
                                        setPenaltyForm((prev) => ({
                                            ...prev,
                                            count: Number(e.target.value),
                                        }))
                                    }
                                    className="input w-16 text-center text-sm py-1"
                                />
                                <button
                                    type="button"
                                    className="btn-warning flex items-center gap-1.5 text-sm px-3 py-1.5"
                                    onClick={() => void handleAddPenalty()}
                                >
                                    <PlusIcon size={15} weight="bold" />
                                    {t('userMatchCard.addPenalty')}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Points tab */}
                {activeTab === 'points' && (
                    <div>
                        {pointGroups.length === 0 ? (
                            <p className="text-text-muted text-sm italic mb-4">
                                No {t('userMatchCard.points').toLowerCase()} recorded yet.
                            </p>
                        ) : (
                            <div className="flex flex-wrap gap-2 mb-4">
                                {pointGroups.map((g) => (
                                    <span
                                        key={g.pointReasonId}
                                        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm border ${
                                            g.pointType === 'Positive'
                                                ? 'bg-emerald-900/30 border-emerald-800/50 text-emerald-300'
                                                : g.pointType === 'Negative'
                                                    ? 'bg-red-950/30 border-red-900/50 text-red-300'
                                                    : 'bg-border border-transparent text-text'
                                        }`}
                                    >
                                        {g.pointReasonName}
                                        <span className="opacity-60 mx-0.5">·</span>
                                        <span>{g.totalCount}</span>
                                        {isAuth && (
                                            <button
                                                aria-label={`delete point reason ${g.pointReasonId}`}
                                                onClick={() => void handleDeletePointsByReason(g.ids)}
                                                className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
                                            >
                                                <XIcon size={13} />
                                            </button>
                                        )}
                                    </span>
                                ))}
                            </div>
                        )}
                        {isAuth && (
                            <div className="flex flex-col gap-3 bg-bg/50 p-4 rounded-lg border border-border">
                                {/* Segmented control */}
                                <div className="flex gap-2">
                                    {(['Positive', 'Neutral', 'Negative'] as PointType[]).map((type) => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => handlePointTypeChange(type)}
                                            className={pointTypeButtonClass(type)}
                                        >
                                            {t(`common.${type.toLowerCase()}`)}
                                        </button>
                                    ))}
                                </div>

                                {/* Reason + count + add */}
                                <div className="flex flex-wrap items-center gap-3">
                                    <select
                                        value={pointForm.pointReasonId}
                                        onChange={(e) =>
                                            setPointForm((prev) => ({
                                                ...prev,
                                                pointReasonId: e.target.value === '' ? '' : Number(e.target.value),
                                            }))
                                        }
                                        className="input flex-1 min-w-[180px] text-sm py-1.5"
                                    >
                                        <option value="">{t('common.select')}</option>
                                        {reasonsForType[pointForm.pointType].map((r) => (
                                            <option key={r.id} value={r.id}>
                                                {r.name}
                                            </option>
                                        ))}
                                    </select>
                                    <input
                                        type="number"
                                        aria-label={t('userMatchCard.pointCount')}
                                        min={1}
                                        value={pointForm.count}
                                        onChange={(e) =>
                                            setPointForm((prev) => ({ ...prev, count: Number(e.target.value) }))
                                        }
                                        className="input w-16 text-center text-sm py-1"
                                    />
                                    <button
                                        type="button"
                                        className={`flex items-center gap-1.5 rounded-lg font-semibold transition-colors disabled:opacity-50 ${addPointButtonClass()}`}
                                        disabled={pointForm.pointReasonId === ''}
                                        onClick={() =>
                                            void handleAddPoint(pointForm.pointReasonId, pointForm.count)
                                        }
                                    >
                                        <PlusIcon size={15} weight="bold" />
                                        {t(`common.${pointForm.pointType.toLowerCase()}`)}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* PP/SH goal modal */}
            {goalModal && (
                <Modal
                    title={
                        goalModal.goalType === 'PowerPlay'
                            ? t('userMatchCard.ppGoalTitle')
                            : t('userMatchCard.shGoalTitle')
                    }
                    onClose={() => setGoalModal(null)}
                >
                    <div className="space-y-4">
                        <div>
                            <label className="label block mb-1 text-sm">{t('common.type')}</label>
                            <SearchableSelect
                                options={(goalModal.goalType === 'PowerPlay'
                                    ? positiveReasons.filter((r) => r.isActive)
                                    : neutralReasons.filter((r) => r.isActive)
                                ).map((r) => ({ value: r.id, label: r.name }))}
                                value={goalModal.pointReasonId}
                                onChange={(v) =>
                                    setGoalModal((prev) =>
                                        prev ? { ...prev, pointReasonId: v === '' ? '' : Number(v) } : null,
                                    )
                                }
                                placeholder={t('common.select')}
                            />
                        </div>
                        <div>
                            <label className="label block mb-1 text-sm">{t('userMatchCard.pointRecipient')}</label>
                            <SearchableSelect
                                options={allUserMatches.map((u) => ({ value: u.id, label: u.userName ?? '' }))}
                                value={goalModal.pointRecipientUserMatchId}
                                onChange={(v) =>
                                    setGoalModal((prev) =>
                                        prev
                                            ? { ...prev, pointRecipientUserMatchId: v === '' ? '' : Number(v) }
                                            : null,
                                    )
                                }
                                placeholder={t('userMatchCard.selectUser')}
                            />
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button type="button" onClick={() => setGoalModal(null)} className="btn-ghost text-sm">
                                {t('common.cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleGoalModalConfirm()}
                                disabled={
                                    goalModal.pointRecipientUserMatchId === '' ||
                                    goalModal.pointReasonId === '' ||
                                    goalForm.rosterPlayerId === ''
                                }
                                className="btn-primary text-sm disabled:opacity-50"
                            >
                                {t('userMatchCard.confirm')}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    )
}
