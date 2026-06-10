import { useState } from 'react'
import {
    TrashIcon,
    XIcon,
    MagnifyingGlassIcon,
    UserIcon,
    CheckIcon,
    WarningIcon,
    MinusCircleIcon,
    PlusCircleIcon,
    CircleIcon,
} from '@phosphor-icons/react'
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
    onNeutralPointAdded?: (userMatchId: number, pointReasonId: number) => Promise<void>
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
    onNeutralPointAdded,
}: Props) {
    const { t } = useTranslation()
    const toast = useToast()

    const [selectedRosterId, setSelectedRosterId] = useState<number | ''>('')
    const [playerSearch, setPlayerSearch] = useState('')
    const [goalModal, setGoalModal] = useState<GoalModal | null>(null)
    const [showMore, setShowMore] = useState<Record<PointType, boolean>>({
        Negative: false,
        Positive: false,
        Neutral: false,
    })

    const toggleShowMore = (type: PointType) =>
        setShowMore((prev) => ({ ...prev, [type]: !prev[type] }))

    const positiveReasons = pointReasons.filter((r) => r.pointType === 'Positive')
    const negativeReasons = pointReasons.filter((r) => r.pointType === 'Negative')
    const neutralReasons = pointReasons.filter((r) => r.pointType === 'Neutral')

    const totalPlus = points.filter((p) => p.pointType === 'Positive').reduce((sum, p) => sum + p.count, 0)
    const totalMinus = points.filter((p) => p.pointType === 'Negative').reduce((sum, p) => sum + p.count, 0)
    const totalNeutral = points.filter((p) => p.pointType === 'Neutral').reduce((sum, p) => sum + p.count, 0)

    const selectedPlayer = roster.find((r) => r.id === selectedRosterId)
    const filteredRoster = playerSearch
        ? roster.filter((r) =>
              `${r.firstName} ${r.surname}`.toLowerCase().includes(playerSearch.toLowerCase()),
          )
        : []

    const handleAddPoint = async (reasonId: number) => {
        await apiClient.post<UserMatchPoint>(`/api/usermatches/${um.id}/points`, {
            pointReasonId: reasonId,
            count: 1,
        } as CreateUserMatchPointDto)
        const reason = pointReasons.find((r) => r.id === reasonId)
        if (reason?.pointType === 'Negative') {
            await onNegativePointAdded?.(reasonId)
        }
        if (reason?.pointType === 'Neutral') {
            await onNeutralPointAdded?.(um.id, reasonId)
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
        if (selectedRosterId === '') return
        await apiClient.post<UserMatchGoal>(`/api/usermatches/${um.id}/goals`, {
            rosterPlayerId: selectedRosterId,
            count: 1,
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
        if (selectedRosterId === '') return
        try {
            await apiClient.post(`/api/usermatches/${goalModal.pointRecipientUserMatchId}/points`, {
                pointReasonId: goalModal.pointReasonId,
                count: 1,
            } as CreateUserMatchPointDto)
            await apiClient.post(`/api/usermatches/${um.id}/goals`, {
                rosterPlayerId: selectedRosterId,
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
        if (selectedRosterId === '') return
        await apiClient.post<UserMatchPenalty>(`/api/usermatches/${um.id}/penalties`, {
            rosterPlayerId: selectedRosterId,
            count: 1,
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

    const hasEntries = goalGroups.length > 0 || penaltyGroups.length > 0 || pointGroups.length > 0

    const NEGATIVE_ORDER = ['Penalty', 'Secondary penalty', 'Error in defense', 'Last minute action', 'Own goal']
    const POSITIVE_ORDER = ['Secondary penalty', 'Last minute action']
    const NEUTRAL_ORDER = ['Offside', 'Icing', 'Secondary shorthanded goal']

    const sortByOrder = (reasons: PointReason[], order: string[]) =>
        order
            .map((name) => reasons.find((r) => r.name.toLowerCase() === name.toLowerCase() && r.isActive))
            .filter((r): r is PointReason => r !== undefined)

    const reasonChipClass = (type: PointType) => {
        if (type === 'Negative') return 'bg-red-950/30 border-red-900/50 text-red-300 hover:bg-red-950/50'
        if (type === 'Positive') return 'bg-emerald-900/30 border-emerald-800/50 text-emerald-300 hover:bg-emerald-900/50'
        return 'bg-surface border-border text-text hover:bg-border/70'
    }

    return (
        <div id={`user-${um.id}`} className="card overflow-hidden scroll-mt-40">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                <h2 className="flex items-center gap-2 text-base font-semibold">
                    <UserIcon size={16} className="text-text-muted" />
                    {um.userName}
                    <span className="h-2 w-2 bg-success rounded-full animate-pulse" />
                </h2>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-xs font-mono bg-bg px-3 py-1 rounded-full border border-border">
                        <span className="text-success font-bold">+{totalPlus}</span>
                        <span className="text-border">|</span>
                        <span className="text-danger font-bold">−{totalMinus}</span>
                        {totalNeutral > 0 && (
                            <>
                                <span className="text-border">|</span>
                                <span className="text-text-muted font-bold flex items-center gap-1">
                                    <span className="h-1.5 w-1.5 rounded-full border border-text-muted inline-block" />
                                    {totalNeutral}
                                </span>
                            </>
                        )}
                    </div>
                    {isAuth && (
                        <button
                            onClick={() => void handleDeleteUserMatch()}
                            aria-label={t('userMatchCard.deleteUserMatch')}
                            className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                        >
                            <TrashIcon size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* Recorded entries — flat unified list, always visible */}
            <div className="px-5 py-3 border-b border-border">
                <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto">
                    {hasEntries ? (
                        <>
                            {goalGroups.map((g) => (
                                <span
                                    key={`${g.rosterPlayerId}-${g.goalType}`}
                                    className="flex items-center gap-1 bg-blue-900/30 border border-blue-800/50 text-blue-300 rounded-full px-2.5 py-0.5 text-xs"
                                >
                                    {g.firstName} {g.surname}
                                    {g.goalType !== 'Regular' && (
                                        <span className="font-bold ml-0.5">
                                            {g.goalType === 'PowerPlay' ? 'PP' : 'SH'}
                                        </span>
                                    )}
                                    <span className="opacity-60 mx-0.5">·</span>
                                    <span>{g.totalCount}</span>
                                    {isAuth && (
                                        <button
                                            aria-label={`delete goal for player ${g.rosterPlayerId}`}
                                            onClick={() => void handleDeleteGoal(g.ids)}
                                            className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
                                        >
                                            <XIcon size={11} />
                                        </button>
                                    )}
                                </span>
                            ))}
                            {penaltyGroups.map((p) => (
                                <span
                                    key={p.rosterPlayerId}
                                    className="flex items-center gap-1 bg-amber-900/30 border border-amber-700/50 text-amber-300 rounded-full px-2.5 py-0.5 text-xs"
                                >
                                    {p.firstName} {p.surname}
                                    <span className="opacity-60 mx-0.5">·</span>
                                    <span>{p.totalCount}</span>
                                    {isAuth && (
                                        <button
                                            aria-label={`delete penalty for player ${p.rosterPlayerId}`}
                                            onClick={() => void handleDeletePenalty(p.ids)}
                                            className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
                                        >
                                            <XIcon size={11} />
                                        </button>
                                    )}
                                </span>
                            ))}
                            {pointGroups.map((g) => (
                                <span
                                    key={g.pointReasonId}
                                    className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs border ${
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
                                            <XIcon size={11} />
                                        </button>
                                    )}
                                </span>
                            ))}
                        </>
                    ) : (
                        <span className="text-xs text-text-muted italic py-0.5">
                            {t('userMatchCard.noEntries')}
                        </span>
                    )}
                </div>
            </div>

            {/* Auth input section */}
            {isAuth && (
                <>
                    {/* Zone A: Player Actions */}
                    <div className="px-5 py-4 border-b border-border space-y-3">
                        <h3 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                            {t('userMatchCard.playerActions')}
                        </h3>

                        {/* Player search — combobox style */}
                        <div className="relative">
                            {selectedPlayer ? (
                                <div className="input w-full text-sm py-2 flex items-center justify-between">
                                    <span className="font-semibold text-sm">
                                        {selectedPlayer.firstName} {selectedPlayer.surname}
                                    </span>
                                    <button
                                        onClick={() => setSelectedRosterId('')}
                                        className="text-text-muted hover:text-text transition-colors"
                                        aria-label="Clear player selection"
                                    >
                                        <XIcon size={15} />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-text-muted pointer-events-none" />
                                    <input
                                        type="text"
                                        placeholder={t('userMatchCard.searchPlayer')}
                                        value={playerSearch}
                                        onChange={(e) => setPlayerSearch(e.target.value)}
                                        className="input w-full pl-9 text-sm py-2"
                                    />
                                    {playerSearch && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                                            {filteredRoster.length > 0 ? (
                                                filteredRoster.map((p) => (
                                                    <div
                                                        key={p.id}
                                                        onMouseDown={() => {
                                                            setSelectedRosterId(p.id)
                                                            setPlayerSearch('')
                                                        }}
                                                        className="px-4 py-2.5 hover:bg-bg cursor-pointer text-sm border-b border-border/50 last:border-0"
                                                    >
                                                        {p.firstName} {p.surname}
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="px-4 py-2.5 text-sm text-text-muted italic">
                                                    {t('userMatchCard.selectPlayer')}…
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Quick action buttons */}
                        <div
                            className={`grid grid-cols-4 gap-2 transition-opacity duration-200 ${
                                !selectedRosterId ? 'opacity-30 pointer-events-none' : ''
                            }`}
                        >
                            <button
                                type="button"
                                onClick={() => void handleAddGoal('Regular')}
                                className="btn-primary text-xs py-2 font-semibold flex items-center justify-center gap-1.5"
                            >
                                <CheckIcon size={13} weight="bold" />
                                {t('userMatchCard.goal')}
                            </button>
                            <button
                                type="button"
                                onClick={() => handleOpenGoalModal('PowerPlay')}
                                className="bg-border hover:bg-border/70 text-primary border border-border text-xs py-2 rounded-lg font-semibold transition-colors"
                            >
                                PP
                            </button>
                            <button
                                type="button"
                                onClick={() => handleOpenGoalModal('ShortHanded')}
                                className="bg-border hover:bg-border/70 text-primary border border-border text-xs py-2 rounded-lg font-semibold transition-colors"
                            >
                                SH
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleAddPenalty()}
                                className="btn-warning text-xs py-2 font-semibold flex items-center justify-center gap-1.5"
                            >
                                <WarningIcon size={13} weight="bold" />
                                {t('userMatchCard.penalty')}
                            </button>
                        </div>
                    </div>

                    {/* Zone B: Points — three labeled rows, always active */}
                    <div className="px-5 py-4 space-y-2">
                        <h3 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-3">
                            {t('userMatchCard.points')}
                        </h3>

                        {/* Negative row */}
                        <div className="bg-surface/50 px-3 py-2.5 rounded-lg flex flex-col sm:flex-row gap-2 sm:items-center">
                            <div className="flex items-center gap-1.5 sm:w-24 flex-shrink-0 text-danger text-[10px] font-bold uppercase tracking-wider">
                                <MinusCircleIcon size={13} />
                                {t('common.negative')}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {(showMore.Negative ? negativeReasons.filter((r) => r.isActive) : sortByOrder(negativeReasons, NEGATIVE_ORDER))
                                    .map((reason) => (
                                        <button
                                            key={reason.id}
                                            type="button"
                                            onClick={() => void handleAddPoint(reason.id)}
                                            className={`px-2.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all active:scale-[0.98] border ${reasonChipClass('Negative')}`}
                                        >
                                            {reason.name}
                                        </button>
                                    ))}
                                {negativeReasons.filter((r) => r.isActive).length > NEGATIVE_ORDER.length && (
                                    <button
                                        type="button"
                                        onClick={() => toggleShowMore('Negative')}
                                        className="px-2.5 py-1.5 rounded-md text-xs font-semibold text-text-muted hover:text-text border border-dashed border-border hover:border-text-muted transition-all"
                                    >
                                        {showMore.Negative ? t('common.showLess') : t('common.showMore')}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Positive row */}
                        <div className="bg-surface/50 px-3 py-2.5 rounded-lg flex flex-col sm:flex-row gap-2 sm:items-center">
                            <div className="flex items-center gap-1.5 sm:w-24 flex-shrink-0 text-success text-[10px] font-bold uppercase tracking-wider">
                                <PlusCircleIcon size={13} />
                                {t('common.positive')}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {(showMore.Positive ? positiveReasons.filter((r) => r.isActive) : sortByOrder(positiveReasons, POSITIVE_ORDER))
                                    .map((reason) => (
                                        <button
                                            key={reason.id}
                                            type="button"
                                            onClick={() => void handleAddPoint(reason.id)}
                                            className={`px-2.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all active:scale-[0.98] border ${reasonChipClass('Positive')}`}
                                        >
                                            {reason.name}
                                        </button>
                                    ))}
                                {positiveReasons.filter((r) => r.isActive).length > POSITIVE_ORDER.length && (
                                    <button
                                        type="button"
                                        onClick={() => toggleShowMore('Positive')}
                                        className="px-2.5 py-1.5 rounded-md text-xs font-semibold text-text-muted hover:text-text border border-dashed border-border hover:border-text-muted transition-all"
                                    >
                                        {showMore.Positive ? t('common.showLess') : t('common.showMore')}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Neutral row */}
                        <div className="bg-surface/50 px-3 py-2.5 rounded-lg flex flex-col sm:flex-row gap-2 sm:items-center">
                            <div className="flex items-center gap-1.5 sm:w-24 flex-shrink-0 text-text-muted text-[10px] font-bold uppercase tracking-wider">
                                <CircleIcon size={13} />
                                {t('common.neutral')}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {(showMore.Neutral ? neutralReasons.filter((r) => r.isActive) : sortByOrder(neutralReasons, NEUTRAL_ORDER))
                                    .map((reason) => (
                                        <button
                                            key={reason.id}
                                            type="button"
                                            onClick={() => void handleAddPoint(reason.id)}
                                            className={`px-2.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all active:scale-[0.98] border ${reasonChipClass('Neutral')}`}
                                        >
                                            {reason.name}
                                        </button>
                                    ))}
                                {neutralReasons.filter((r) => r.isActive).length > NEUTRAL_ORDER.length && (
                                    <button
                                        type="button"
                                        onClick={() => toggleShowMore('Neutral')}
                                        className="px-2.5 py-1.5 rounded-md text-xs font-semibold text-text-muted hover:text-text border border-dashed border-border hover:border-text-muted transition-all"
                                    >
                                        {showMore.Neutral ? t('common.showLess') : t('common.showMore')}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}

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
                                    selectedRosterId === ''
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
