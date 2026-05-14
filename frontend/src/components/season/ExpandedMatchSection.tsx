import { useTranslation } from 'react-i18next'
import type { WeeklyMatchUser } from '../../types/stats'
import type { UserMatchPoint, UserMatchGoal, UserMatchPenalty } from '../../types/userMatch'
import { PointsTooltip, GoalsTooltip, PenaltiesTooltip, BetCellTooltip } from './MatchTooltips'

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
}

export default function ExpandedMatchSection({ users, detail }: Props) {
    const { t } = useTranslation()

    return (
        <div className="border-t border-border bg-bg/50">
            <table className="w-full text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-text-muted border-b border-border bg-bg/80">
                    <tr>
                        <th className="py-2.5 px-4 font-bold text-left">{t('season.player')}</th>
                        <th className="py-2.5 px-3 font-bold text-center w-12">+</th>
                        <th className="py-2.5 px-3 font-bold text-center w-12">−</th>
                        <th className="py-2.5 px-3 font-bold text-center w-12">○</th>
                        <th className="py-2.5 px-4 font-bold text-center w-16">{t('season.goals')}</th>
                        <th className="py-2.5 px-4 font-bold text-center w-20">{t('season.penalties')}</th>
                        <th className="py-2.5 px-4 font-bold text-center w-20">{t('season.bet')}</th>
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
                                <td className="py-2.5 px-4 font-semibold">{u.userName}</td>
                                <td className="py-2.5 px-3 text-center">
                                    <div className="relative group inline-block cursor-default">
                                        <span className="text-success font-bold tabular-nums">{u.totalPlus > 0 ? `+${u.totalPlus}` : '0'}</span>
                                        <PointsTooltip points={posPoints} />
                                    </div>
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                    <div className="relative group inline-block cursor-default">
                                        <span className="text-danger font-bold tabular-nums">{u.totalMinus > 0 ? u.totalMinus : '0'}</span>
                                        <PointsTooltip points={negPoints} />
                                    </div>
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                    <div className="relative group inline-block cursor-default">
                                        <span className="text-text-muted font-bold tabular-nums">{u.totalNeutral > 0 ? u.totalNeutral : '0'}</span>
                                        <PointsTooltip points={neutralPoints} />
                                    </div>
                                </td>
                                <td className="py-2.5 px-4 text-center">
                                    <div className="relative group inline-block cursor-default">
                                        <span className="font-bold text-text tabular-nums">{u.totalGoals}</span>
                                        {ud && <GoalsTooltip goals={ud.goals} />}
                                    </div>
                                </td>
                                <td className="py-2.5 px-4 text-center">
                                    <div className="relative group inline-block cursor-default">
                                        <span className="text-text-muted font-medium tabular-nums">{u.totalPenalties}</span>
                                        {ud && <PenaltiesTooltip penalties={ud.penalties} />}
                                    </div>
                                </td>
                                <td className="py-2.5 px-4 text-center">
                                    {u.betResult && u.betResult !== 'Cancelled' && u.betAmount != null ? (
                                        <div className="relative group inline-block cursor-default">
                                            <span className={
                                                u.betResult === 'Won' ? 'text-success font-medium tabular-nums' :
                                                u.betResult === 'Lost' ? 'text-danger tabular-nums' :
                                                'text-text-muted tabular-nums'
                                            }>
                                                {u.betResult === 'Won' && u.betWonAmount != null
                                                    ? `+${u.betWonAmount.toFixed(2)}€`
                                                    : u.betResult === 'Lost'
                                                        ? `-${u.betAmount.toFixed(2)}€`
                                                        : `${u.betAmount.toFixed(2)}€`}
                                            </span>
                                            <BetCellTooltip betType={u.betType ?? null} targetName={u.betTargetName ?? null} />
                                        </div>
                                    ) : (
                                        <span className="text-text-muted">—</span>
                                    )}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}
