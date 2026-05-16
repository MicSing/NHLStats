import { useEffect, useState } from 'react'
import { Trophy, Skull, Hockey, FlagBanner } from '@phosphor-icons/react'
import type { Season } from '../types/season'
import type { User } from '../types/user'
import type { DashboardData, MatchHistoryItem, PointReasonBreakdownItem, RosterPenalizedByUser, RosterScorerByUser, SeasonMatchHistory } from '../types/stats'
import { cacheService } from '../services/cacheService'
import { bettingService } from '../services/bettingService'
import type { BetDto, BetLegDto } from '../types/bet'
import PenaltyPointedChart from '../components/charts/PenaltyPointedChart'
import MinusPointsPieChart from '../components/charts/MinusPointsPieChart'
import UserWeekTrendChart from '../components/charts/UserWeekTrendChart'
import TopScorersChart from '../components/charts/TopScorersChart'
import PenaltyLeadersChart from '../components/charts/PenaltyLeadersChart'
import { useTranslation } from 'react-i18next'
import { teamLogoUrl } from '../utils/teamLogoUrl'

interface MatchWithContext extends MatchHistoryItem {
    seasonId: number
    seasonName: string
    weekNumber: number
}

interface WeekSummary {
    seasonId: number
    seasonName: string
    weekNumber: number
    matchDates: string[]
    matchCount: number
    totalPlus: number
    totalMinus: number
    goalCount: number
    penaltyCount: number
    opponents: { name: string; shortName: string }[]
}

function flattenMatches(data: SeasonMatchHistory[]): MatchWithContext[] {
    return data.flatMap((s) =>
        s.weeks.flatMap((w) =>
            w.matches.map((m) => ({
                ...m,
                seasonId: s.seasonId,
                seasonName: s.seasonName,
                weekNumber: w.weekNumber,
            })),
        ),
    )
}

function flattenWeeks(data: SeasonMatchHistory[]): WeekSummary[] {
    return data.flatMap((s) =>
        s.weeks.map((w) => ({
            seasonId: s.seasonId,
            seasonName: s.seasonName,
            weekNumber: w.weekNumber,
            matchDates: [...new Set(w.matches.map((m) => m.matchDate.slice(0, 10)))].sort(),
            matchCount: w.matches.length,
            totalPlus: w.totalPlus,
            totalMinus: w.totalMinus,
            goalCount: w.goalCount,
            penaltyCount: w.penaltyCount,
            opponents: w.matches.map((m) => ({ name: m.opponentName, shortName: m.opponentShortName })),
        })),
    )
}

function MatchCard({ variant, match, seasonWeekLabel }: {
    variant: 'best' | 'worst'
    match: MatchHistoryItem | null
    seasonWeekLabel?: string
}) {
    const { t } = useTranslation()
    const isBest = variant === 'best'
    const borderColor = isBest ? 'border-l-success' : 'border-l-danger'
    const labelColor = isBest ? 'text-success' : 'text-danger'
    const Icon = isBest ? Trophy : Skull
    const label = isBest ? t('userStats.bestMatch') : t('userStats.worstMatch')

    if (!match) {
        return (
            <div className={`bg-surface rounded-xl p-5 border border-border border-l-4 ${borderColor} flex flex-col gap-2`}>
                <span className={`text-[10px] uppercase tracking-wider font-medium flex items-center gap-1.5 ${labelColor}`}>
                    <Icon size={14} weight="bold" />
                    {label}
                </span>
                <p className="text-text-muted text-sm">{t('common.noData')}</p>
            </div>
        )
    }

    const logo = teamLogoUrl(match.opponentShortName || '')
    const date = new Date(match.matchDate).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    })
    const score = `${match.homeScore}–${match.awayScore}`
    const side = match.isHome ? t('userStats.home') : t('userStats.away')
    const dateLine = seasonWeekLabel ? `${date} · ${seasonWeekLabel}` : date

    return (
        <div className={`bg-surface rounded-xl p-5 border border-border border-l-4 ${borderColor} flex flex-col gap-3`}>
            <span className={`text-[10px] uppercase tracking-wider font-medium flex items-center gap-1.5 ${labelColor}`}>
                <Icon size={14} weight="bold" />
                {label}
            </span>
            <div className="flex items-center gap-3">
                <img
                    src={logo}
                    alt={match.opponentName}
                    className="w-8 h-8 object-contain flex-shrink-0"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                />
                <div className="min-w-0">
                    <p className="text-text font-semibold text-sm truncate">{match.opponentName}</p>
                    <p className="text-text-muted text-xs">{score} · {side}</p>
                </div>
            </div>
            <p className="text-text-muted text-xs">{dateLine}</p>
            <div className="flex gap-4 items-center mt-auto pt-1">
                <span className="text-success font-bold text-lg">+{match.totalPlus}</span>
                <span className="text-danger font-bold text-lg">−{match.totalMinus}</span>
                <span className="flex items-center gap-1 text-text-muted font-bold text-lg">
                    <Hockey size={18} />
                    {match.goalCount}
                </span>
                <span className="flex items-center gap-1 text-text-muted font-bold text-lg">
                    <FlagBanner size={18} />
                    {match.penaltyCount}
                </span>
            </div>
        </div>
    )
}

function WeekCard({ variant, week }: { variant: 'best' | 'worst'; week: WeekSummary | null }) {
    const { t } = useTranslation()
    const isBest = variant === 'best'
    const borderColor = isBest ? 'border-l-success' : 'border-l-danger'
    const labelColor = isBest ? 'text-success' : 'text-danger'
    const Icon = isBest ? Trophy : Skull
    const label = isBest ? t('userStats.bestWeek') : t('userStats.worstWeek')

    if (!week) {
        return (
            <div className={`bg-surface rounded-xl p-5 border border-border border-l-4 ${borderColor} flex flex-col gap-2`}>
                <span className={`text-[10px] uppercase tracking-wider font-medium flex items-center gap-1.5 ${labelColor}`}>
                    <Icon size={14} weight="bold" />
                    {label}
                </span>
                <p className="text-text-muted text-sm">{t('common.noData')}</p>
            </div>
        )
    }

    const dateLabels = week.matchDates.map((d) => {
        const date = new Date(d + 'T00:00:00Z')
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' })
    })

    const uniqueOpponents = week.opponents.filter(
        (o, i, arr) => arr.findIndex((x) => x.shortName === o.shortName) === i,
    )

    return (
        <div className={`bg-surface rounded-xl p-5 border border-border border-l-4 ${borderColor} flex flex-col gap-3`}>
            <span className={`text-[10px] uppercase tracking-wider font-medium flex items-center gap-1.5 ${labelColor}`}>
                <Icon size={14} weight="bold" />
                {label}
            </span>
            <div>
                <p className="text-text font-bold text-base">{week.seasonName} · {t('userStats.weekLabel', { week: week.weekNumber })}</p>
                <p className="text-text-muted text-xs mt-0.5">{dateLabels.join(', ')}</p>
            </div>
            <div className="flex gap-1 flex-wrap">
                {uniqueOpponents.map((opp, idx) => (
                    <img
                        key={idx}
                        src={teamLogoUrl(opp.shortName || '')}
                        alt={opp.name}
                        title={opp.name}
                        className="w-6 h-6 object-contain"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                    />
                ))}
            </div>
            <div className="flex gap-4 items-center mt-auto pt-1">
                <span className="text-success font-bold text-lg">+{week.totalPlus}</span>
                <span className="text-danger font-bold text-lg">−{week.totalMinus}</span>
                <span className="flex items-center gap-1 text-text-muted font-bold text-lg">
                    <Hockey size={18} />
                    {week.goalCount}
                </span>
                <span className="flex items-center gap-1 text-text-muted font-bold text-lg">
                    <FlagBanner size={18} />
                    {week.penaltyCount}
                </span>
            </div>
        </div>
    )
}

const LEG_TYPE_LABEL: Record<BetLegDto['betType'], string> = {
    TeamWin: 'Win',
    TeamWinOrDraw: '1X',
    TeamDraw: 'Draw',
    UserGoal: 'Goal',
    UserPenalty: 'Penalty',
    UserPlusPoint: '+Point',
    UserMinusPoint: '−Point',
}

const LEG_STATUS_DOT: Record<BetLegDto['status'], string> = {
    Pending: 'bg-blue-400',
    Won: 'bg-green-500',
    Lost: 'bg-red-500',
    Cancelled: 'bg-gray-500',
}

function BetCard({ variant, bet }: { variant: 'best' | 'worst'; bet: BetDto | null }) {
    const { t } = useTranslation()
    const isBest = variant === 'best'
    const borderColor = isBest ? 'border-l-success' : 'border-l-danger'
    const labelColor = isBest ? 'text-success' : 'text-danger'
    const Icon = isBest ? Trophy : Skull
    const label = isBest ? t('userStats.bestBet') : t('userStats.worstBet')

    if (!bet) {
        return (
            <div className={`bg-surface rounded-xl p-5 border border-border border-l-4 ${borderColor} flex flex-col gap-2`}>
                <span className={`text-[10px] uppercase tracking-wider font-medium flex items-center gap-1.5 ${labelColor}`}>
                    <Icon size={14} weight="bold" />
                    {label}
                </span>
                <p className="text-text-muted text-sm">{t('common.noData')}</p>
            </div>
        )
    }

    const date = new Date(bet.evaluatedOn ?? bet.createdOn).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
    })
    const structure = bet.legs.length === 1 ? t('userStats.betSingle') : t('userStats.betCombo', { count: bet.legs.length })
    const potentialWin = bet.stake * bet.totalOdds
    const netProfit = bet.wonAmount != null ? bet.wonAmount - bet.stake : null

    return (
        <div className={`bg-surface rounded-xl p-5 border border-border border-l-4 ${borderColor} flex flex-col gap-3`}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <span className={`text-[10px] uppercase tracking-wider font-medium flex items-center gap-1.5 ${labelColor}`}>
                    <Icon size={14} weight="bold" />
                    {label}
                </span>
                <span className="text-[10px] uppercase tracking-wider font-bold text-text-muted bg-border/50 px-1.5 py-0.5 rounded">
                    {structure}
                </span>
            </div>

            {/* ID + date */}
            <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-text bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                    {bet.shortId}
                </span>
                <span className="text-text-muted text-xs">{date}</span>
            </div>

            {/* Legs */}
            <div className="space-y-1.5">
                {bet.legs.map((leg) => {
                    const matchName = leg.homeTeamName && leg.awayTeamName
                        ? `${leg.homeTeamName} vs ${leg.awayTeamName}`
                        : `Match #${leg.matchNumber}`
                    const typeLabel = LEG_TYPE_LABEL[leg.betType] ?? leg.betType
                    return (
                        <div key={leg.id} className="bg-bg rounded-lg px-3 py-2 flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${LEG_STATUS_DOT[leg.status]}`} />
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] text-text-muted truncate">{matchName}</p>
                                <p className="text-xs text-text font-medium truncate">
                                    <span className="text-text-muted">{typeLabel}:</span>{' '}
                                    {leg.targetName ?? '—'}
                                </p>
                            </div>
                            <span className="text-xs font-mono text-text-muted shrink-0">{leg.odds.toFixed(2)}</span>
                        </div>
                    )
                })}
            </div>

            {/* Bottom: financials */}
            <div className="flex items-end justify-between mt-auto pt-1 border-t border-border/50">
                <div className="text-xs text-text-muted">
                    {bet.stake.toFixed(2)}€ <span className="opacity-60">×</span> {bet.totalOdds.toFixed(2)}
                </div>
                {isBest ? (
                    <div className="text-right">
                        <div className="text-success font-bold text-lg leading-none">{bet.wonAmount!.toFixed(2)}€</div>
                        {netProfit != null && (
                            <div className="text-[10px] text-success/70 mt-0.5">+{netProfit.toFixed(2)}€ profit</div>
                        )}
                    </div>
                ) : (
                    <div className="text-right">
                        <div className="text-danger font-bold text-lg leading-none">−{bet.stake.toFixed(2)}€</div>
                        <div className="text-[10px] text-text-muted mt-0.5">could win {potentialWin.toFixed(2)}€</div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default function UserStatsPage() {
    const { t } = useTranslation()
    const [seasons, setSeasons] = useState<Season[]>([])
    const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null)
    const [users, setUsers] = useState<User[]>([])
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
    const [loadingSeasons, setLoadingSeasons] = useState(true)
    const [loadingUsers, setLoadingUsers] = useState(false)
    const [loadingData, setLoadingData] = useState(false)
    const [breakdownItems, setBreakdownItems] = useState<PointReasonBreakdownItem[]>([])
    const [allMatchData, setAllMatchData] = useState<SeasonMatchHistory[]>([])
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
    const [allBets, setAllBets] = useState<BetDto[] | null>(null)

    useEffect(() => {
        cacheService
            .getSeasons()
            .then((data) => {
                const sorted = [...data].sort(
                    (a, b) => new Date(b.startedOn).getTime() - new Date(a.startedOn).getTime(),
                )
                setSeasons(sorted)
            })
            .finally(() => setLoadingSeasons(false))
    }, [])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoadingUsers(true)
        cacheService.getUsers()
            .then((fetched) => {
                const active = fetched.filter((u) => u.isActive !== false)
                setUsers(active)
                if (active.length > 0) setSelectedUserId(active[0].id)
            })
            .catch(() => setUsers([]))
            .finally(() => setLoadingUsers(false))
    }, [])

    useEffect(() => {
        cacheService.getDashboardData()
            .then((data) => setDashboardData(data))
            .catch(() => setDashboardData(null))
    }, [])

    useEffect(() => {
        bettingService.listAll()
            .then((bets) => setAllBets(bets))
            .catch(() => setAllBets([]))
    }, [])

    useEffect(() => {
        if (selectedUserId == null) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setAllMatchData([])
            return
        }
        cacheService.getUserMatchHistory(selectedUserId)
            .then((matchHistory) => setAllMatchData(matchHistory))
            .catch(() => setAllMatchData([]))
    }, [selectedUserId])

    useEffect(() => {
        if (selectedUserId == null) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setBreakdownItems([])
            return
        }
        setLoadingData(true)
        cacheService.getUserBreakdown(selectedUserId, selectedSeasonId ?? undefined)
            .then((breakdown) => setBreakdownItems(breakdown.items))
            .catch(() => setBreakdownItems([]))
            .finally(() => setLoadingData(false))
    }, [selectedUserId, selectedSeasonId])

    // ── Derived data ─────────────────────────────────────────────────
    const matchData = selectedSeasonId
        ? allMatchData.filter((s) => s.seasonId === selectedSeasonId)
        : allMatchData

    const allMatches = flattenMatches(matchData)
    const allWeeks = flattenWeeks(matchData)

    const userTopScorers: RosterScorerByUser[] = (() => {
        if (!dashboardData || selectedUserId == null) return []
        const source = selectedSeasonId
            ? dashboardData.rosterScorers.filter((s) => s.seasonId === selectedSeasonId)
            : dashboardData.allTimeRosterScorers
        return source
            .map((player) => {
                const match = player.userCounts.find((uc) => uc.userId === selectedUserId)
                const userCount = match?.count ?? 0
                return {
                    rosterPlayerId: player.rosterPlayerId,
                    firstName: player.firstName,
                    surname: player.surname,
                    teamShortName: null,
                    totalCount: userCount,
                    userCounts: match ? [match] : [],
                }
            })
            .filter((p) => p.totalCount > 0)
            .sort((a, b) => b.totalCount - a.totalCount)
    })()

    const userPenaltyLeaders: RosterPenalizedByUser[] = (() => {
        if (!dashboardData || selectedUserId == null) return []
        const source = selectedSeasonId
            ? dashboardData.rosterPenalized.filter((p) => p.seasonId === selectedSeasonId)
            : dashboardData.allTimeRosterPenalized
        return source
            .map((player) => {
                const match = player.userCounts.find((uc) => uc.userId === selectedUserId)
                const userCount = match?.count ?? 0
                return {
                    rosterPlayerId: player.rosterPlayerId,
                    firstName: player.firstName,
                    surname: player.surname,
                    teamShortName: null,
                    totalCount: userCount,
                    userCounts: match ? [match] : [],
                }
            })
            .filter((p) => p.totalCount > 0)
            .sort((a, b) => b.totalCount - a.totalCount)
    })()

    const overallTotalPlus = matchData.reduce((sum, s) => sum + s.totalPlus, 0)
    const overallTotalMinus = matchData.reduce((sum, s) => sum + s.totalMinus, 0)
    const overallGoalCount = matchData.reduce((sum, s) => sum + s.goalCount, 0)
    const overallPenaltyCount = matchData.reduce((sum, s) => sum + s.penaltyCount, 0)
    const overallMatchCount = allMatches.length

    function compareBest(a: MatchHistoryItem, b: MatchHistoryItem): number {
        const netA = a.totalPlus - a.totalMinus
        const netB = b.totalPlus - b.totalMinus
        if (netB !== netA) return netB - netA
        if (b.goalCount !== a.goalCount) return b.goalCount - a.goalCount
        return a.penaltyCount - b.penaltyCount
    }

    function compareWorst(a: MatchHistoryItem, b: MatchHistoryItem): number {
        const netA = a.totalMinus - a.totalPlus
        const netB = b.totalMinus - b.totalPlus
        if (netB !== netA) return netB - netA
        if (b.penaltyCount !== a.penaltyCount) return b.penaltyCount - a.penaltyCount
        return a.goalCount - b.goalCount
    }

    const bestMatch = allMatches.length > 0 ? [...allMatches].sort(compareBest)[0] : null
    const worstMatch = allMatches.length > 0 ? [...allMatches].sort(compareWorst)[0] : null

    function getSeasonWeekLabel(m: MatchWithContext): string {
        return t('userStats.seasonWeekLabel', { season: m.seasonName, week: m.weekNumber })
    }

    function compareWeekBest(a: WeekSummary, b: WeekSummary): number {
        const netA = a.totalPlus - a.totalMinus
        const netB = b.totalPlus - b.totalMinus
        if (netB !== netA) return netB - netA
        if (b.goalCount !== a.goalCount) return b.goalCount - a.goalCount
        return a.penaltyCount - b.penaltyCount
    }

    function compareWeekWorst(a: WeekSummary, b: WeekSummary): number {
        const netA = a.totalMinus - a.totalPlus
        const netB = b.totalMinus - b.totalPlus
        if (netB !== netA) return netB - netA
        if (b.penaltyCount !== a.penaltyCount) return b.penaltyCount - a.penaltyCount
        return a.goalCount - b.goalCount
    }

    const bestWeek = allWeeks.length > 0 ? [...allWeeks].sort(compareWeekBest)[0] : null
    const worstWeek = allWeeks.length > 0 ? [...allWeeks].sort(compareWeekWorst)[0] : null

    const selectedUser = users.find((u) => u.id === selectedUserId) ?? null
    const userBets = allBets !== null && selectedUser
        ? allBets.filter((b) => b.createdByName === selectedUser.name)
        : []
    const userTicketCount = userBets.filter((b) => b.status !== 'Cancelled').length

    const wonBets = userBets.filter((b) => b.status === 'Won' && b.wonAmount != null)
    const bestBet = wonBets.length > 0
        ? wonBets.reduce((best, b) => (b.wonAmount! > best.wonAmount! ? b : best))
        : null

    const lostBets = userBets.filter((b) => b.status === 'Lost')
    const worstBet = lostBets.length > 0
        ? lostBets.reduce((worst, b) => (b.stake > worst.stake ? b : worst))
        : null

    const selectClass = 'bg-surface border border-border text-text text-sm rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary transition-colors appearance-none'

    return (
        <div>
            {/* ── Sticky header ──────────────────────────────────────────── */}
            <header className="sticky top-0 z-40 bg-bg/80 backdrop-blur-md border-b border-border px-6 py-3">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <h1 className="text-lg font-semibold tracking-tight text-text">{t('userStats.title')}</h1>
                    <div className="flex gap-3 flex-wrap">
                        {loadingSeasons ? (
                            <span className="text-text-muted text-sm">{t('userStats.loadingSeasons')}</span>
                        ) : (
                            <select
                                aria-label={t('seasonSelector.selectSeason')}
                                value={selectedSeasonId ?? ''}
                                onChange={(e) => setSelectedSeasonId(e.target.value ? Number(e.target.value) : null)}
                                className={selectClass}
                            >
                                <option value="">{t('seasonSelector.allSeasons')}</option>
                                {seasons.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        )}
                        {loadingUsers ? (
                            <span className="text-text-muted text-sm">{t('userStats.loadingPlayers')}</span>
                        ) : (
                            <select
                                aria-label={t('userStats.selectPlayer')}
                                value={selectedUserId ?? ''}
                                onChange={(e) => setSelectedUserId(e.target.value ? Number(e.target.value) : null)}
                                className={selectClass}
                            >
                                {users.length === 0 && <option value="">{t('userStats.noPlayers')}</option>}
                                {users.map((u) => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        )}
                        {loadingData && (
                            <span className="text-text-muted text-sm self-center">{t('userStats.loadingStats')}</span>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

                {/* ── KPI cards ──────────────────────────────────────────── */}
                {matchData.length > 0 && (
                    <section>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            <div className="bg-surface rounded-xl p-5 border border-border">
                                <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium block">
                                    {t('userStats.matchesPlayed')}
                                </span>
                                <div className="text-3xl font-bold mt-1 text-text">{overallMatchCount}</div>
                            </div>
                            <div className="bg-surface rounded-xl p-5 border border-border">
                                <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium block">
                                    {t('userStats.totalPlus')}
                                </span>
                                <div className="text-3xl font-bold mt-1 text-success">+{overallTotalPlus}</div>
                            </div>
                            <div className="bg-surface rounded-xl p-5 border border-border">
                                <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium block">
                                    {t('userStats.totalMinus')}
                                </span>
                                <div className="text-3xl font-bold mt-1 text-danger">−{overallTotalMinus}</div>
                            </div>
                            <div className="bg-surface rounded-xl p-5 border border-border">
                                <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium block">
                                    {t('userStats.goals')}
                                </span>
                                <div className="text-3xl font-bold mt-1 text-text">{overallGoalCount}</div>
                            </div>
                            <div className="bg-surface rounded-xl p-5 border border-border">
                                <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium block">
                                    {t('userStats.penalties')}
                                </span>
                                <div className="text-3xl font-bold mt-1 text-text-muted">{overallPenaltyCount}</div>
                            </div>
                            <div className="bg-surface rounded-xl p-5 border border-border">
                                <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium block">
                                    {t('userStats.tickets')}
                                </span>
                                <div className="text-3xl font-bold mt-1 text-text">{userTicketCount}</div>
                            </div>
                        </div>
                    </section>
                )}

                {/* ── Charts: 2/3 + 1/3 ─────────────────────────────────── */}
                <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-surface rounded-xl p-6 border border-border">
                        <h3 className="text-sm font-semibold text-text">{t('userStats.penalties')}</h3>
                        <p className="text-xs text-text-muted mt-1 mb-5">{t('userStats.penaltiesDesc')}</p>
                        <PenaltyPointedChart items={breakdownItems} rosterPenaltyCount={overallPenaltyCount} />
                    </div>
                    <div className="bg-surface rounded-xl p-6 border border-border">
                        <h3 className="text-sm font-semibold text-text">{t('userStats.minusBreakdown')}</h3>
                        <p className="text-xs text-text-muted mt-1 mb-5">{t('userStats.minusBreakdownDesc')}</p>
                        <MinusPointsPieChart items={breakdownItems} />
                    </div>
                </section>

                {/* ── Trend chart ────────────────────────────────────────── */}
                <section className="bg-surface rounded-xl p-6 border border-border">
                    <h3 className="text-sm font-semibold text-text">{t('userStats.weekTrend')}</h3>
                    <p className="text-xs text-text-muted mt-1 mb-5">{t('userStats.weekTrendDesc')}</p>
                    <UserWeekTrendChart seasons={matchData} />
                </section>

                {/* ── Partners ───────────────────────────────────────────── */}
                {(userTopScorers.length > 0 || userPenaltyLeaders.length > 0) && (
                    <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {userTopScorers.length > 0 && (
                            <div className="bg-surface rounded-xl p-6 border border-border">
                                <h3 className="text-sm font-semibold text-text">{t('userStats.yourTopScorers')}</h3>
                                <p className="text-xs text-text-muted mt-1 mb-5">{t('userStats.scoringPartnersDesc')}</p>
                                <TopScorersChart data={userTopScorers} hideLegend />
                            </div>
                        )}
                        {userPenaltyLeaders.length > 0 && (
                            <div className="bg-surface rounded-xl p-6 border border-border">
                                <h3 className="text-sm font-semibold text-text">{t('userStats.yourPenaltyLeaders')}</h3>
                                <p className="text-xs text-text-muted mt-1 mb-5">{t('userStats.penaltyPartnersDesc')}</p>
                                <PenaltyLeadersChart data={userPenaltyLeaders} hideLegend />
                            </div>
                        )}
                    </section>
                )}

                {/* ── Records 4-card row ─────────────────────────────────── */}
                <section>
                    <h3 className="text-sm font-semibold text-text mb-1">{t('userStats.records')}</h3>
                    <p className="text-xs text-text-muted mb-4">{t('userStats.recordsDesc')}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <MatchCard variant="best" match={bestMatch} seasonWeekLabel={bestMatch ? getSeasonWeekLabel(bestMatch) : undefined} />
                        <WeekCard variant="best" week={bestWeek} />
                        <MatchCard variant="worst" match={worstMatch} seasonWeekLabel={worstMatch ? getSeasonWeekLabel(worstMatch) : undefined} />
                        <WeekCard variant="worst" week={worstWeek} />
                    </div>
                </section>

                {/* ── Betting Records ────────────────────────────────── */}
                {(bestBet !== null || worstBet !== null) && (
                    <section>
                        <h3 className="text-sm font-semibold text-text mb-1">{t('userStats.bettingRecords')}</h3>
                        <p className="text-xs text-text-muted mb-4">{t('userStats.bettingRecordsDesc')}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <BetCard variant="best" bet={bestBet} />
                            <BetCard variant="worst" bet={worstBet} />
                        </div>
                    </section>
                )}

            </main>
        </div>
    )
}
