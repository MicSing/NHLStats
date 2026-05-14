import { Link } from 'react-router-dom'
import { CaretDown, ArrowsClockwise, PencilSimple } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import type { WeekGroup } from '../../types/stats'
import type { Match } from '../../types/match'
import type { Season } from '../../types/season'
import { CompletionType } from '../../types/match'
import { teamLogoUrl } from '../../utils/teamLogoUrl'
import CompletionBadge from '../CompletionBadge'
import ExpandedMatchSection, { type MatchExpandDetail } from './ExpandedMatchSection'
import { normalizeCompletionType, aggregateWeekUsers } from './seasonUtils'

function StatsTooltip({
    users,
    weekNumber,
}: {
    users: { userId: number; userName: string; totalPlus: number; totalMinus: number; totalGoals: number; totalPenalties: number }[]
    weekNumber: number
}) {
    const { t } = useTranslation()
    if (!users || users.length === 0) return null
    return (
        <div className="absolute bottom-full right-0 mb-2 z-50 pointer-events-none opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 w-60">
            <div className="bg-surface border border-border rounded-lg shadow-card px-3 py-3">
                <div className="text-[10px] uppercase tracking-wider text-text-muted font-bold border-b border-border pb-1 mb-2 text-center">
                    {t('season.week', { number: weekNumber })} Summary
                </div>
                <table className="w-full text-xs">
                    <thead>
                        <tr className="text-text-muted border-b border-border">
                            <th className="pb-1 text-left font-semibold">{t('season.player')}</th>
                            <th className="pb-1 text-center font-semibold">+</th>
                            <th className="pb-1 text-center font-semibold">&minus;</th>
                            <th className="pb-1 text-center font-semibold">{t('season.goals')}</th>
                            <th className="pb-1 text-center font-semibold">{t('season.penalties')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((u) => (
                            <tr key={u.userId} className="border-b border-border/50 last:border-b-0">
                                <td className="py-1 font-medium">{u.userName}</td>
                                <td className="py-1 text-center text-success tabular-nums">
                                    {u.totalPlus > 0 ? `+${u.totalPlus}` : '0'}
                                </td>
                                <td className="py-1 text-center text-danger tabular-nums">
                                    {u.totalMinus > 0 ? u.totalMinus : '0'}
                                </td>
                                <td className="py-1 text-center tabular-nums">{u.totalGoals}</td>
                                <td className="py-1 text-center tabular-nums">{u.totalPenalties}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

interface Props {
    weekGroups: WeekGroup[]
    allMatches: Match[]
    seasonId: number
    seasons: Season[]
    expandedMatchId: number | null
    matchDetailCache: Map<number, MatchExpandDetail>
    reEvaluatingMatchId: number | null
    isAdmin: boolean
    onToggleExpand: (matchId: number) => void
    onReEvaluateBets: (matchId: number) => void
}

export default function WeeklyMatches({
    weekGroups,
    allMatches,
    seasonId,
    seasons,
    expandedMatchId,
    matchDetailCache,
    reEvaluatingMatchId,
    isAdmin,
    onToggleExpand,
    onReEvaluateBets,
}: Props) {
    const { t } = useTranslation()

    if (weekGroups.length === 0) return null

    const matchNumberById = new Map(allMatches.map((m) => [m.id, m.matchNumber]))
    const season = seasons.find((s) => s.id === seasonId)
    const hostedTeamId = season?.hostedTeamId ?? null

    return (
        <section aria-label="Weekly matches">
            <h2 className="text-sm font-bold uppercase tracking-wider border-b border-border pb-2 mb-4">
                {t('season.matchesByWeek')}
            </h2>
            {weekGroups.map((group) => (
                <div key={group.weekNumber} className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider">
                            {t('season.week', { number: group.weekNumber })}
                        </h3>
                        <div className="relative group cursor-help">
                            <StatsTooltip users={aggregateWeekUsers(group)} weekNumber={group.weekNumber} />
                            <div className="flex items-center gap-3 bg-bg px-3 py-1 rounded border border-border transition-colors group-hover:border-text-muted">
                                <span className="text-sm font-bold text-success">+{group.totalPlus}</span>
                                <span className="text-border">|</span>
                                <span className="text-sm font-bold text-danger">−{group.totalMinus}</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        {[...group.matches]
                            .sort((a, b) => (matchNumberById.get(b.matchId) ?? 0) - (matchNumberById.get(a.matchId) ?? 0))
                            .map((m) => {
                                const isHome = hostedTeamId != null && m.homeTeamId === hostedTeamId
                                const isAway = hostedTeamId != null && m.awayTeamId === hostedTeamId
                                const hostedScore = isHome ? m.homeScore : isAway ? m.awayScore : null
                                const opponentScore = isHome ? m.awayScore : isAway ? m.homeScore : null
                                const isWin = hostedScore != null && opponentScore != null && hostedScore > opponentScore
                                const isLoss = hostedScore != null && opponentScore != null && hostedScore < opponentScore
                                const completionType = normalizeCompletionType(m.completionType)
                                const isCompleted =
                                    completionType === CompletionType.RegularTime ||
                                    completionType === CompletionType.Overtime ||
                                    completionType === CompletionType.Shootout
                                const matchNumber = matchNumberById.get(m.matchId)
                                const isExpanded = expandedMatchId === m.matchId
                                const detail = matchDetailCache.get(m.matchId)
                                const homeLogo = teamLogoUrl(m.homeTeamShortName ?? '')
                                const awayLogo = teamLogoUrl(m.awayTeamShortName ?? '')
                                const homeWins = m.homeScore > m.awayScore
                                const awayWins = m.awayScore > m.homeScore
                                const borderColor = isWin
                                    ? 'border-l-success'
                                    : isLoss
                                        ? 'border-l-danger'
                                        : 'border-l-transparent'

                                return (
                                    <div
                                        key={m.matchId}
                                        className={`bg-surface border border-border rounded-lg overflow-hidden shadow-card border-l-4 ${borderColor}`}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => onToggleExpand(m.matchId)}
                                            className="p-3 flex items-center justify-between w-full text-left hover:bg-bg/40 transition-colors group"
                                        >
                                            {/* Home team */}
                                            <div className={`flex items-center gap-3 w-[30%] ${!homeWins && isCompleted ? 'opacity-60' : ''}`}>
                                                <span className="text-xs font-bold text-text-muted tabular-nums w-8 flex-shrink-0">
                                                    {matchNumber != null ? `#${matchNumber}` : ''}
                                                </span>
                                                <img
                                                    src={homeLogo}
                                                    alt={m.homeTeamShortName ?? ''}
                                                    className="w-7 h-7 object-contain flex-shrink-0"
                                                    onError={(e) => { ;(e.target as HTMLImageElement).style.display = 'none' }}
                                                />
                                                <span className={`font-bold text-sm ${homeWins ? 'text-text' : 'text-text-muted'}`}>
                                                    {m.homeTeamShortName}
                                                </span>
                                            </div>

                                            {/* Score */}
                                            <div className="flex items-center justify-center gap-3 w-[40%]">
                                                <span className={`text-2xl font-bold tabular-nums ${homeWins ? 'text-text' : 'text-text-muted'}`}>
                                                    {m.homeScore}
                                                </span>
                                                <span className="text-text-muted/50">—</span>
                                                <span className={`text-2xl font-bold tabular-nums ${awayWins ? 'text-text' : 'text-text-muted'}`}>
                                                    {m.awayScore}
                                                </span>
                                                {completionType !== CompletionType.None && (
                                                    <CompletionBadge type={completionType} />
                                                )}
                                            </div>

                                            {/* Away team */}
                                            <div className={`flex items-center justify-end gap-2 w-[30%] ${!awayWins && isCompleted ? 'opacity-60' : ''}`}>
                                                <span className={`font-bold text-sm ${awayWins ? 'text-text' : 'text-text-muted'}`}>
                                                    {m.awayTeamShortName}
                                                </span>
                                                <img
                                                    src={awayLogo}
                                                    alt={m.awayTeamShortName ?? ''}
                                                    className="w-7 h-7 object-contain flex-shrink-0"
                                                    onError={(e) => { ;(e.target as HTMLImageElement).style.display = 'none' }}
                                                />
                                                <CaretDown
                                                    size={16}
                                                    aria-hidden="true"
                                                    className={`text-text-muted group-hover:text-text transition-all flex-shrink-0 duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                                />
                                                <span className="sr-only">{isExpanded ? '▲' : '▼'}</span>
                                            </div>
                                        </button>

                                        {isExpanded && (
                                            <div>
                                                <ExpandedMatchSection
                                                    users={m.users ?? []}
                                                    detail={detail}
                                                />
                                                {isAdmin && (
                                                    <div className="flex items-center justify-end gap-3 p-3 border-t border-border/50 bg-bg/30">
                                                        {isCompleted && (
                                                            <button
                                                                type="button"
                                                                onClick={() => onReEvaluateBets(m.matchId)}
                                                                disabled={reEvaluatingMatchId === m.matchId}
                                                                className="group flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted border border-border rounded transition-colors hover:border-text hover:text-text disabled:opacity-50"
                                                            >
                                                                <ArrowsClockwise size={12} />
                                                                <span>{reEvaluatingMatchId === m.matchId ? '…' : t('season.reEvaluateBets')}</span>
                                                            </button>
                                                        )}
                                                        <Link
                                                            to={`/seasons/${seasonId}/matches/${m.matchId}`}
                                                            className="group flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted border border-border rounded transition-colors hover:border-primary hover:text-primary"
                                                        >
                                                            <PencilSimple size={12} />
                                                            <span>{t('season.editMatch')}</span>
                                                        </Link>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                    </div>
                </div>
            ))}
        </section>
    )
}
