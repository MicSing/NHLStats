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
import type { PointReason } from '../types/pointReason'
import apiClient from '../services/apiClient'
import SearchableSelect from './SearchableSelect'
import { useTranslation } from 'react-i18next'

type Tab = 'goals' | 'penalties' | 'points'

interface Props {
    userMatch: UserMatch
    points: UserMatchPoint[]
    goals: UserMatchGoal[]
    penalties: UserMatchPenalty[]
    roster: RosterPlayer[]
    pointReasons: PointReason[]
    isAuth: boolean
    onChanged: () => void
}

export default function UserMatchCard({
    userMatch: um,
    points,
    goals,
    penalties,
    roster,
    pointReasons,
    isAuth,
    onChanged,
}: Props) {
    const { t } = useTranslation()
    const [activeTab, setActiveTab] = useState<Tab>('goals')
    const [posPointForm, setPosPointForm] = useState<{ pointReasonId: number | ''; count: number }>({
        pointReasonId: '',
        count: 1,
    })
    const [negPointForm, setNegPointForm] = useState<{ pointReasonId: number | ''; count: number }>({
        pointReasonId: '',
        count: 1,
    })
    const [goalForm, setGoalForm] = useState<{ rosterPlayerId: number | ''; count: number }>({
        rosterPlayerId: '',
        count: 1,
    })
    const [showGoalTypes, setShowGoalTypes] = useState(false)
    const [penaltyForm, setPenaltyForm] = useState<{
        rosterPlayerId: number | ''
        count: number
    }>({ rosterPlayerId: '', count: 1 })

    const positiveReasons = pointReasons.filter((r) => r.isPositive)
    const negativeReasons = pointReasons.filter((r) => !r.isPositive)

    const handleAddPoint = async (reasonId: number | '', count: number) => {
        if (reasonId === '') return
        await apiClient.post<UserMatchPoint>(`/api/usermatches/${um.id}/points`, {
            pointReasonId: reasonId,
            count,
        } as CreateUserMatchPointDto)
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
        onChanged()
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
                <div className="flex gap-4 text-sm">
                    <span className="text-success">+{um.totalPlus}</span>
                    <span className="text-danger">−{um.totalMinus}</span>
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
                                setShowGoalTypes(false)
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
                            <div className="relative flex">
                                <button
                                    type="submit"
                                    className="btn-primary text-sm px-3 py-1 rounded-r-none border-r border-white/20"
                                >
                                    {t('userMatchCard.addGoal')}
                                </button>
                                <button
                                    type="button"
                                    className="btn-primary text-sm px-2 py-1 rounded-l-none"
                                    onClick={() => setShowGoalTypes((prev) => !prev)}
                                    aria-label="More goal types"
                                >
                                    ▾
                                </button>
                                {showGoalTypes && (
                                    <div className="absolute top-full right-0 flex gap-1 mt-1 z-10">
                                        <button
                                            type="button"
                                            className="btn-primary text-sm px-3 py-1"
                                            onClick={() => {
                                                void handleAddGoal('PowerPlay')
                                                setShowGoalTypes(false)
                                            }}
                                        >
                                            {t('userMatchCard.addGoalPP')}
                                        </button>
                                        <button
                                            type="button"
                                            className="btn-primary text-sm px-3 py-1"
                                            onClick={() => {
                                                void handleAddGoal('ShortHanded')
                                                setShowGoalTypes(false)
                                            }}
                                        >
                                            {t('userMatchCard.addGoalSH')}
                                        </button>
                                    </div>
                                )}
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
                                        isPositive: boolean
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
                                        isPositive: p.isPositive,
                                        totalCount: p.count,
                                        ids: [p.id],
                                    }
                                }
                                return acc
                            }, {}),
                        ).map((g) => (
                            <span
                                key={g.pointReasonId}
                                className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm ${g.isPositive
                                    ? 'bg-success/20 text-success'
                                    : 'bg-danger/20 text-danger'
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
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
