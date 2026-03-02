import { useState } from 'react'
import type {
    UserMatch,
    UserMatchPoint,
    UserMatchGoal,
    UserMatchPenalty,
    CreateUserMatchPointDto,
    CreateUserMatchGoalDto,
    CreateUserMatchPenaltyDto,
} from '../types/userMatch'
import type { RosterPlayer } from '../types/roster'
import type { PointReason } from '../types/pointReason'
import apiClient from '../services/apiClient'
import SearchableSelect from './SearchableSelect'

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
    const [activeTab, setActiveTab] = useState<Tab>('goals')
    const [pointForm, setPointForm] = useState<{ pointReasonId: number | ''; count: number }>({
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

    const positiveReasons = pointReasons.filter((r) => r.isPositive)
    const negativeReasons = pointReasons.filter((r) => !r.isPositive)

    const handleAddPoint = async (reasonId: number | '') => {
        if (reasonId === '') return
        await apiClient.post<UserMatchPoint>(`/api/usermatches/${um.id}/points`, {
            pointReasonId: reasonId,
            count: pointForm.count,
        } as CreateUserMatchPointDto)
        onChanged()
    }

    const handleDeletePoint = async (pointId: number) => {
        await apiClient.delete(`/api/usermatches/${um.id}/points/${pointId}`)
        onChanged()
    }

    const handleAddGoal = async () => {
        if (goalForm.rosterPlayerId === '') return
        await apiClient.post<UserMatchGoal>(`/api/usermatches/${um.id}/goals`, {
            rosterPlayerId: goalForm.rosterPlayerId,
            count: goalForm.count,
        } as CreateUserMatchGoalDto)
        onChanged()
    }

    const handleDeleteGoal = async (goalId: number) => {
        await apiClient.delete(`/api/usermatches/${um.id}/goals/${goalId}`)
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

    const handleDeletePenalty = async (penaltyId: number) => {
        await apiClient.delete(`/api/usermatches/${um.id}/penalties/${penaltyId}`)
        onChanged()
    }

    const tabClass = (tab: Tab) =>
        `px-3 py-1 text-sm rounded-t font-medium transition-colors ${activeTab === tab
            ? 'bg-gray-700 text-white'
            : 'text-gray-400 hover:text-gray-200'
        }`

    return (
        <div className="bg-gray-800 rounded-xl p-5">
            {/* Card header */}
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">{um.userName}</h2>
                <div className="flex gap-4 text-sm">
                    <span className="text-green-400">+{um.totalPlus}</span>
                    <span className="text-red-400">−{um.totalMinus}</span>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-gray-700 mb-3">
                <button className={tabClass('goals')} onClick={() => setActiveTab('goals')}>
                    Goals ({goals.length})
                </button>
                <button className={tabClass('penalties')} onClick={() => setActiveTab('penalties')}>
                    Penalties ({penalties.length})
                </button>
                <button className={tabClass('points')} onClick={() => setActiveTab('points')}>
                    Points ({points.length})
                </button>
            </div>

            {/* Goals tab */}
            {activeTab === 'goals' && (
                <div>
                    <div className="flex flex-wrap gap-2 mb-2">
                        {goals.map((g) => (
                            <span
                                key={g.id}
                                className="flex items-center gap-1 bg-gray-700 rounded-full px-3 py-1 text-sm"
                            >
                                {g.playerFirstName} {g.playerSurname} × {g.count}
                                {isAuth && (
                                    <button
                                        aria-label={`delete goal ${g.id}`}
                                        onClick={() => void handleDeleteGoal(g.id)}
                                        className="text-red-400 hover:text-red-300 ml-1 leading-none"
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
                                void handleAddGoal()
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
                                placeholder="Select player"
                            />
                            <input
                                type="number"
                                aria-label="goal count"
                                min={1}
                                value={goalForm.count}
                                onChange={(e) =>
                                    setGoalForm((prev) => ({ ...prev, count: Number(e.target.value) }))
                                }
                                className="bg-gray-700 rounded px-2 py-1 text-sm w-16"
                            />
                            <button
                                type="submit"
                                className="bg-cyan-700 hover:bg-cyan-600 px-3 py-1 rounded text-sm"
                            >
                                + Goal
                            </button>
                        </form>
                    )}
                </div>
            )}

            {/* Penalties tab */}
            {activeTab === 'penalties' && (
                <div>
                    <div className="flex flex-wrap gap-2 mb-2">
                        {penalties.map((p) => (
                            <span
                                key={p.id}
                                className="flex items-center gap-1 bg-gray-700 rounded-full px-3 py-1 text-sm"
                            >
                                {p.playerFirstName} {p.playerSurname} × {p.count}
                                {isAuth && (
                                    <button
                                        aria-label={`delete penalty ${p.id}`}
                                        onClick={() => void handleDeletePenalty(p.id)}
                                        className="text-red-400 hover:text-red-300 ml-1 leading-none"
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
                                placeholder="Select player"
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
                                className="bg-gray-700 rounded px-2 py-1 text-sm w-16"
                            />
                            <button
                                type="submit"
                                className="bg-orange-700 hover:bg-orange-600 px-3 py-1 rounded text-sm"
                            >
                                + Penalty
                            </button>
                        </form>
                    )}
                </div>
            )}

            {/* Points tab */}
            {activeTab === 'points' && (
                <div>
                    <div className="flex flex-wrap gap-2 mb-2">
                        {points.map((p) => (
                            <span
                                key={p.id}
                                className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm ${p.isPositive ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'
                                    }`}
                            >
                                {p.pointReasonName} × {p.count}
                                {isAuth && (
                                    <button
                                        aria-label={`delete point ${p.id}`}
                                        onClick={() => void handleDeletePoint(p.id)}
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
                                <span className="text-xs text-gray-400 w-12 shrink-0">+ Point</span>
                                <SearchableSelect
                                    options={positiveReasons.map((r) => ({
                                        value: r.id,
                                        label: r.name,
                                    }))}
                                    value={pointForm.pointReasonId}
                                    onChange={(v) =>
                                        setPointForm((prev) => ({
                                            ...prev,
                                            pointReasonId: v === '' ? '' : Number(v),
                                        }))
                                    }
                                    placeholder="Positive reason"
                                />
                                <input
                                    type="number"
                                    aria-label="point count"
                                    min={1}
                                    value={pointForm.count}
                                    onChange={(e) =>
                                        setPointForm((prev) => ({
                                            ...prev,
                                            count: Number(e.target.value),
                                        }))
                                    }
                                    className="bg-gray-700 rounded px-2 py-1 text-sm w-16"
                                />
                                <button
                                    onClick={() => void handleAddPoint(pointForm.pointReasonId)}
                                    className="bg-green-700 hover:bg-green-600 px-3 py-1 rounded text-sm"
                                >
                                    + Point
                                </button>
                            </div>
                            {/* Negative points */}
                            <div className="flex gap-2 items-center">
                                <span className="text-xs text-gray-400 w-12 shrink-0">− Point</span>
                                <SearchableSelect
                                    options={negativeReasons.map((r) => ({
                                        value: r.id,
                                        label: r.name,
                                    }))}
                                    value={pointForm.pointReasonId}
                                    onChange={(v) =>
                                        setPointForm((prev) => ({
                                            ...prev,
                                            pointReasonId: v === '' ? '' : Number(v),
                                        }))
                                    }
                                    placeholder="Negative reason"
                                />
                                <input
                                    type="number"
                                    aria-label="point count"
                                    min={1}
                                    value={pointForm.count}
                                    onChange={(e) =>
                                        setPointForm((prev) => ({
                                            ...prev,
                                            count: Number(e.target.value),
                                        }))
                                    }
                                    className="bg-gray-700 rounded px-2 py-1 text-sm w-16"
                                />
                                <button
                                    onClick={() => void handleAddPoint(pointForm.pointReasonId)}
                                    className="bg-red-700 hover:bg-red-600 px-3 py-1 rounded text-sm"
                                >
                                    − Point
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
