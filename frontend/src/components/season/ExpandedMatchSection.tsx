import { useTranslation } from 'react-i18next'
import type { WeeklyMatchUser } from '../../types/stats'
import type { UserMatchPoint, UserMatchGoal, UserMatchPenalty } from '../../types/userMatch'
import { PointsTooltip, GoalsTooltip, PenaltiesTooltip } from './MatchTooltips'

export interface MatchUserDetail {
    userMatchId: number
    userId: number
    points: UserMatchPoint[]
    goals: UserMatchGoal[]
    penalties: UserMatchPenalty[]
}

export interface MatchExpandDetail {
    users: MatchUserDetail[]
}

interface Props {
    users: WeeklyMatchUser[]
    detail: MatchExpandDetail | undefined
    ticketCounts?: Record<string, number>
}

export default function ExpandedMatchSection({ users, detail, ticketCounts }: Props) {
    const { t } = useTranslation()

    return (
        <div className="border-t border-border bg-bg/50">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-text-muted border-b border-border bg-bg/80">
                    <tr>
                        <th className="py-2 px-2 sm:py-2.5 sm:px-4 font-bold text-left">{t('season.player')}</th>
                        <th className="py-2 px-2 sm:py-2.5 sm:px-3 font-bold text-center w-12">+</th>
                        <th className="py-2 px-2 sm:py-2.5 sm:px-3 font-bold text-center w-12">−</th>
                        <th className="py-2 px-2 sm:py-2.5 sm:px-3 font-bold text-center w-12">○</th>
                        <th className="py-2 px-2 sm:py-2.5 sm:px-4 font-bold text-center w-16">{t('season.goals')}</th>
                        <th className="py-2 px-2 sm:py-2.5 sm:px-4 font-bold text-center w-20">{t('season.penalties')}</th>
                        <th className="py-2 px-2 sm:py-2.5 sm:px-4 font-bold text-center w-16">{t('season.tickets')}</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map((u) => {
                        const ud = detail?.users.find((d) => d.userId === u.userId)
                        const posPoints = ud?.points.filter((p) => p.pointType === 'Positive') ?? []
                        const negPoints = ud?.points.filter((p) => p.pointType === 'Negative') ?? []
                        const neutralPoints = ud?.points.filter((p) => p.pointType === 'Neutral') ?? []
                        return (
                            <tr key={u.userId} className="border-b border-border/50 last:border-b-0 hover:bg-surface/80 transition-colors">
                                <td className="py-2 px-2 sm:py-2.5 sm:px-4 font-semibold">{u.userName}</td>
                                <td className="py-2 px-2 sm:py-2.5 sm:px-3 text-center">
                                    <div className="relative group inline-block cursor-default">
                                        <span className="text-success font-bold tabular-nums">{u.totalPlus > 0 ? `+${u.totalPlus}` : '0'}</span>
                                        <PointsTooltip points={posPoints} />
                                    </div>
                                </td>
                                <td className="py-2 px-2 sm:py-2.5 sm:px-3 text-center">
                                    <div className="relative group inline-block cursor-default">
                                        <span className="text-danger font-bold tabular-nums">{u.totalMinus > 0 ? u.totalMinus : '0'}</span>
                                        <PointsTooltip points={negPoints} />
                                    </div>
                                </td>
                                <td className="py-2 px-2 sm:py-2.5 sm:px-3 text-center">
                                    <div className="relative group inline-block cursor-default">
                                        <span className="text-text-muted font-bold tabular-nums">{u.totalNeutral > 0 ? u.totalNeutral : '0'}</span>
                                        <PointsTooltip points={neutralPoints} />
                                    </div>
                                </td>
                                <td className="py-2 px-2 sm:py-2.5 sm:px-4 text-center">
                                    <div className="relative group inline-block cursor-default">
                                        <span className="font-bold text-text tabular-nums">{u.totalGoals}</span>
                                        {ud && <GoalsTooltip goals={ud.goals} />}
                                    </div>
                                </td>
                                <td className="py-2 px-2 sm:py-2.5 sm:px-4 text-center">
                                    <div className="relative group inline-block cursor-default">
                                        <span className="text-text-muted font-medium tabular-nums">{u.totalPenalties}</span>
                                        {ud && <PenaltiesTooltip penalties={ud.penalties} />}
                                    </div>
                                </td>
                                <td className="py-2 px-2 sm:py-2.5 sm:px-4 text-center">
                                    <span className="font-bold tabular-nums text-text">{ticketCounts?.[u.userName] ?? 0}</span>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
            </div>
        </div>
    )
}
