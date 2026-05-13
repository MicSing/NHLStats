import { useState } from 'react'
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
    const [posPointForm, setPosPointForm] = useState<{ pointReasonId: number | ''; count: number }>({
        pointReasonId: '',
        count: 1,
    })
    const [negPointForm, setNegPointForm] = useState<{ pointReasonId: number | ''; count: number }>({
        pointReasonId: '',
        count: 1,
    })
    const [neutralPointForm, setNeutralPointForm] = useState<{ pointReasonId: number | ''; count: number }>({
        pointReasonId: '',
        count: 1,
    })
    const [goalForm, setGoalForm] = useState<{ rosterPlayerId: number | ''; count: number }>({
        rosterPlayerId: '',
        count: 1,
    })
    const [penaltyForm, setPenaltyForm] = useState<{
        rosterPlayerId: number | ''
        count: number
    }>({ rosterPlayerId: '', count: 1 })
    const [goalModal, setGoalModal] = useState<GoalModal | null>(null)

    const positiveReasons = pointReasons.filter((r) => r.pointType === 'Positive')
    const negativeReasons = pointReasons.filter((r) => r.pointType === 'Negative')
    const neutralReasons = pointReasons.filter((r) => r.pointType === 'Neutral')
    const totalPlus = points
        .filter((p) => p.pointType === 'Positive')
        .reduce((sum, p) => sum + p.count, 0)
    const totalMinus = points
        .filter((p) => p.pointType === 'Negative')
        .reduce((sum, p) => sum + p.count, 0)

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
        const preselectedReason = goalType === 'PowerPlay'
            ? (activePositiveReasons.find((r) => r.name === 'Penalty')?.id ?? (activePositiveReasons.length === 1 ? activePositiveReasons[0].id : ''))
            : (activeNeutralReasons.find((r) => r.name === 'Shorthanded Goal')?.id ?? (activeNeutralReasons.length === 1 ? activeNeutralReasons[0].id : ''))
        setGoalModal({
            goalType,
            pointRecipientUserMatchId: '',
            pointReasonId: preselectedReason,
        })
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
        `px-3 py-1 text-sm rounded-t font-medium transition-colors ${activeTab === tab
            ? 'bg-surface text-text border-b-2 border-primary'
            : 'text-text-muted hover:text-text'
        }`

    return (
        <div className="card p-5">
            {/* Card header */}
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">{um.userName}</h2>
                <div className="flex items-center gap-4">
                    <div className="flex gap-4 text-sm">
                        <span className="text-success">+{totalPlus}</span>
                        <span className="text-danger">−{totalMinus}</span>
                    </div>
                    {isAuth && (
                        <button
                            onClick={() => void handleDeleteUserMatch()}
                            className="text-danger hover:opacity-70 text-sm px-2 py-1 border border-danger rounded"
                            aria-label={t('userMatchCard.deleteUserMatch')}
                        >
                            {t('userMatchCard.deleteUserMatch')}
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-border mb-3">
                <button className={tabClass('goals')} onClick={() => setActiveTab('goals')}>
                    {t('userMatchCard.goals')} ({goals.reduce((s, g) => s + g.count, 0)})
                </button>
                <button className={tabClass('penalties')} onClick={() => setActiveTab('penalties')}>
                    {t('userMatchCard.penalties')} ({penalties.reduce((s, p) => s + p.count, 0)})
                </button>
                <button className={tabClass('points')} onClick={() => setActiveTab('points')}>
                    {t('userMatchCard.points')} ({points.reduce((s, p) => s + p.count, 0)})
                </button>
            </div>

            {/* Goals tab */}
            {activeTab === 'goals' && (
                <div>
                    <div className="flex flex-wrap gap-2 mb-2">
                        {Object.values(
                            goals.reduce<
                                Record<string, { rosterPlayerId: number; firstName: string | null; surname: string | null; totalCount: number; ids: number[]; goalType: GoalType }>
                            >((acc, g) => {
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
                        ).map((g) => (
                            <span
                                key={`${g.rosterPlayerId}-${g.goalType}`}
                                className="flex items-center gap-1 bg-border rounded-full px-3 py-1 text-sm"
                            >
                                {g.firstName} {g.surname}
                                {g.goalType !== 'Regular' && (
                                    <span className="text-xs font-semibold text-primary ml-0.5">
                                        {g.goalType === 'PowerPlay' ? 'PP' : 'SH'}
                                    </span>
                                )}
                                {' '}× {g.totalCount}
                                {isAuth && (
                                    <button
                                        aria-label={`delete goal for player ${g.rosterPlayerId}`}
                                        onClick={() => void handleDeleteGoal(g.ids)}
                                        className="text-danger hover:opacity-70 ml-1 leading-none"
                                    >
                                        ✕
                                    </button>
                                )}
                            </span>
                        ))}
                    </div>
                    {isAuth && (
                        <form
                            aria-label={`add goal for ${um.userName}`}
                            onSubmit={(e) => {
                                e.preventDefault()
                                void handleAddGoal('Regular')
                            }}
                            className="flex gap-2 mt-2"
                        >
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
                                aria-label="goal count"
                                min={1}
                                value={goalForm.count}
                                onChange={(e) =>
                                    setGoalForm((prev) => ({ ...prev, count: Number(e.target.value) }))
                                }
                                className="input w-16 text-center text-sm py-1"
                            />
                            <div className="flex gap-1">
                                <button
                                    type="submit"
                                    className="btn-primary text-sm px-3 py-1"
                                >
                                    {t('userMatchCard.addGoal')}
                                </button>
                                <button
                                    type="button"
                                    className="btn-primary text-sm px-3 py-1"
                                    onClick={() => handleOpenGoalModal('PowerPlay')}
                                >
                                    {t('userMatchCard.addGoalPP')}
                                </button>
                                <button
                                    type="button"
                                    className="btn-primary text-sm px-3 py-1"
                                    onClick={() => handleOpenGoalModal('ShortHanded')}
                                >
                                    {t('userMatchCard.addGoalSH')}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            )}

            {/* Penalties tab */}
            {activeTab === 'penalties' && (
                <div>
                    <div className="flex flex-wrap gap-2 mb-2">
                        {Object.values(
                            penalties.reduce<
                                Record<number, { rosterPlayerId: number; firstName: string | null; surname: string | null; totalCount: number; ids: number[] }>
                            >((acc, p) => {
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
                        ).map((p) => (
                            <span
                                key={p.rosterPlayerId}
                                className="flex items-center gap-1 bg-border rounded-full px-3 py-1 text-sm"
                            >
                                {p.firstName} {p.surname} × {p.totalCount}
                                {isAuth && (
                                    <button
                                        aria-label={`delete penalty for player ${p.rosterPlayerId}`}
                                        onClick={() => void handleDeletePenalty(p.ids)}
                                        className="text-danger hover:opacity-70 ml-1 leading-none"
                                    >
                                        ✕
                                    </button>
                                )}
                            </span>
                        ))}
                    </div>
                    {isAuth && (
                        <form
                            aria-label={`add penalty for ${um.userName}`}
                            onSubmit={(e) => {
                                e.preventDefault()
                                void handleAddPenalty()
                            }}
                            className="flex gap-2 mt-2"
                        >
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
                                aria-label="penalty count"
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
                                type="submit"
                                className="btn-warning text-sm px-3 py-1"
                            >
                                {t('userMatchCard.addPenalty')}
                            </button>
                        </form>
                    )}
                </div>
            )}

            {/* Points tab */}
            {activeTab === 'points' && (
                <div>
                    <div className="flex flex-wrap gap-2 mb-2">
                        {Object.values(
                            points.reduce<
                                Record<
                                    number,
                                    {
                                        pointReasonId: number
                                        pointReasonName: string | null
                                        pointType: PointType
                                        totalCount: number
                                        ids: number[]
                                    }
                                >
                            >((acc, p) => {
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
                        ).map((g) => (
                            <span
                                key={g.pointReasonId}
                                className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm ${g.pointType === 'Positive'
                                    ? 'bg-success/20 text-success'
                                    : g.pointType === 'Negative'
                                        ? 'bg-danger/20 text-danger'
                                        : 'bg-border text-text-muted'
                                    }`}
                            >
                                {g.pointReasonName} × {g.totalCount}
                                {isAuth && (
                                    <button
                                        aria-label={`delete point reason ${g.pointReasonId}`}
                                        onClick={() => void handleDeletePointsByReason(g.ids)}
                                        className="hover:opacity-70 ml-1 leading-none"
                                    >
                                        ✕
                                    </button>
                                )}
                            </span>
                        ))}
                    </div>
                    {isAuth && (
                        <div className="space-y-2 mt-2">
                            {/* Positive points */}
                            <div className="flex gap-2 items-center">
                                <span className="text-xs text-text-muted w-12 shrink-0">{t('userMatchCard.addPositive')}</span>
                                <SearchableSelect
                                    options={positiveReasons.map((r) => ({
                                        value: r.id,
                                        label: r.name,
                                    }))}
                                    value={posPointForm.pointReasonId}
                                    onChange={(v) =>
                                        setPosPointForm((prev) => ({
                                            ...prev,
                                            pointReasonId: v === '' ? '' : Number(v),
                                        }))
                                    }
                                    placeholder={t('common.positive')}
                                />
                                <input
                                    type="number"
                                    aria-label="point count"
                                    min={1}
                                    value={posPointForm.count}
                                    onChange={(e) =>
                                        setPosPointForm((prev) => ({
                                            ...prev,
                                            count: Number(e.target.value),
                                        }))
                                    }
                                    className="input w-16 text-center text-sm py-1"
                                />
                                <button
                                    onClick={() => void handleAddPoint(posPointForm.pointReasonId, posPointForm.count)}
                                    className="btn-primary text-sm px-3 py-1"
                                >
                                    {t('userMatchCard.addPositive')}
                                </button>
                            </div>
                            {/* Negative points */}
                            <div className="flex gap-2 items-center">
                                <span className="text-xs text-text-muted w-12 shrink-0">{t('userMatchCard.addNegative')}</span>
                                <SearchableSelect
                                    options={negativeReasons.map((r) => ({
                                        value: r.id,
                                        label: r.name,
                                    }))}
                                    value={negPointForm.pointReasonId}
                                    onChange={(v) =>
                                        setNegPointForm((prev) => ({
                                            ...prev,
                                            pointReasonId: v === '' ? '' : Number(v),
                                        }))
                                    }
                                    placeholder={t('common.negative')}
                                />
                                <input
                                    type="number"
                                    aria-label="point count"
                                    min={1}
                                    value={negPointForm.count}
                                    onChange={(e) =>
                                        setNegPointForm((prev) => ({
                                            ...prev,
                                            count: Number(e.target.value),
                                        }))
                                    }
                                    className="input w-16 text-center text-sm py-1"
                                />
                                <button
                                    onClick={() => void handleAddPoint(negPointForm.pointReasonId, negPointForm.count)}
                                    className="btn-danger text-sm px-3 py-1"
                                >
                                    {t('userMatchCard.addNegative')}
                                </button>
                            </div>
                            {/* Neutral points */}
                            <div className="flex gap-2 items-center">
                                <span className="text-xs text-text-muted w-12 shrink-0">{t('userMatchCard.addNeutral')}</span>
                                <SearchableSelect
                                    options={neutralReasons.map((r) => ({
                                        value: r.id,
                                        label: r.name,
                                    }))}
                                    value={neutralPointForm.pointReasonId}
                                    onChange={(v) =>
                                        setNeutralPointForm((prev) => ({
                                            ...prev,
                                            pointReasonId: v === '' ? '' : Number(v),
                                        }))
                                    }
                                    placeholder={t('common.neutral')}
                                />
                                <input
                                    type="number"
                                    aria-label="point count"
                                    min={1}
                                    value={neutralPointForm.count}
                                    onChange={(e) =>
                                        setNeutralPointForm((prev) => ({
                                            ...prev,
                                            count: Number(e.target.value),
                                        }))
                                    }
                                    className="input w-16 text-center text-sm py-1"
                                />
                                <button
                                    onClick={() => void handleAddPoint(neutralPointForm.pointReasonId, neutralPointForm.count)}
                                    className="btn-ghost text-sm px-3 py-1"
                                >
                                    {t('userMatchCard.addNeutral')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* PP/SH goal modal */}
            {goalModal && (
                <Modal
                    title={goalModal.goalType === 'PowerPlay' ? t('userMatchCard.ppGoalTitle') : t('userMatchCard.shGoalTitle')}
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
                                        prev ? { ...prev, pointRecipientUserMatchId: v === '' ? '' : Number(v) } : null,
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
                                className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover rounded disabled:opacity-50"
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
