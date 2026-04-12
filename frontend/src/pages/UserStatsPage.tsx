import { useEffect, useState } from 'react'
import type { Season } from '../types/season'
import type { User } from '../types/user'
import type { DashboardData, MatchHistoryItem, PointReasonBreakdownItem, RosterPenalizedByUser, RosterScorerByUser, SeasonMatchHistory } from '../types/stats'
import { cacheService } from '../services/cacheService'
import SeasonSelector from '../components/SeasonSelector'
import PenaltyPointedChart from '../components/charts/PenaltyPointedChart'
import MinusPointsPieChart from '../components/charts/MinusPointsPieChart'
import UserWeekTrendChart from '../components/charts/UserWeekTrendChart'
import TopScorersChart from '../components/charts/TopScorersChart'
import PenaltyLeadersChart from '../components/charts/PenaltyLeadersChart'
import { useTranslation } from 'react-i18next'
import { teamLogoUrl } from '../utils/teamLogoUrl'

/** A match with its season/week context attached for display */
interface MatchWithContext extends MatchHistoryItem {
    seasonId: number
    seasonName: string
    weekNumber: number
}

/** Aggregated week summary derived from SeasonMatchHistory */
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

/** Flatten seasons → weeks → matches into a flat list with context */
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

/** Flatten seasons → weeks into WeekSummary list, using pre-computed aggregates */
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

function MatchCard({ title, match, seasonWeekLabel }: { title: string; match: MatchHistoryItem | null; seasonWeekLabel?: string }) {
    const { t } = useTranslation()
    if (!match) {
        return (
            <div className="bg-surface rounded-xl p-6 flex flex-col gap-2">
                <h3 className="text-text-muted text-sm font-semibold uppercase tracking-wide">
                    {title}
                </h3>
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
    const dateLine = seasonWeekLabel ? `${date} (${seasonWeekLabel})` : date

    return (
        <div className="bg-surface rounded-xl p-6 flex flex-col gap-3">
            <h3 className="text-text-muted text-sm font-semibold uppercase tracking-wide">
                {title}
            </h3>
            <div className="flex items-center gap-4">
                <img
                    src={logo}
                    alt={match.opponentName}
                    className="w-12 h-12 object-contain"
                    onError={(e) => {
                        ; (e.currentTarget as HTMLImageElement).style.display = 'none'
                    }}
                />
                <div>
                    <p className="text-text font-semibold">{match.opponentName}</p>
                    <p className="text-text-muted text-sm">
                        {score} · {side} · {dateLine}
                    </p>
                </div>
            </div>
            <div className="flex gap-6 text-sm">
                <span className="text-success font-semibold">+{match.totalPlus}</span>
                <span className="text-danger font-semibold">−{match.totalMinus}</span>
                {match.goalCount > 0 && (
                    <span className="text-text-muted">⛳ {t('userStats.goal', { count: match.goalCount })}</span>
                )}
            </div>
        </div>
    )
}

function WeekCard({ title, week }: { title: string; week: WeekSummary | null }) {
    const { t } = useTranslation()
    if (!week) {
        return (
            <div className="bg-surface rounded-xl p-6 flex flex-col gap-2">
                <h3 className="text-text-muted text-sm font-semibold uppercase tracking-wide">
                    {title}
                </h3>
                <p className="text-text-muted text-sm">{t('common.noData')}</p>
            </div>
        )
    }

    const dateLabels = week.matchDates.map((d) => {
        const date = new Date(d + 'T00:00:00Z')
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            timeZone: 'UTC',
        })
    })
    const weekTitle = `${week.seasonName} ${t('userStats.weekLabel', { week: week.weekNumber })} — ${dateLabels.join(', ')}`

    const uniqueOpponents = week.opponents.filter(
        (o, i, arr) => arr.findIndex((x) => x.shortName === o.shortName) === i,
    )

    return (
        <div className="bg-surface rounded-xl p-6 flex flex-col gap-3">
            <h3 className="text-text-muted text-sm font-semibold uppercase tracking-wide">
                {title}
            </h3>
            <p className="text-text font-semibold text-sm">{weekTitle}</p>
            <div className="grid grid-cols-5 gap-1">
                {uniqueOpponents.map((opp, idx) => (
                    <img
                        key={idx}
                        src={teamLogoUrl(opp.shortName || '')}
                        alt={opp.name}
                        title={opp.name}
                        className="w-8 h-8 object-contain"
                        onError={(e) => {
                            ; (e.currentTarget as HTMLImageElement).style.display = 'none'
                        }}
                    />
                ))}
            </div>
            <div className="flex gap-6 text-sm">
                <span className="text-success font-semibold">+{week.totalPlus}</span>
                <span className="text-danger font-semibold">−{week.totalMinus}</span>
                {week.goalCount > 0 && (
                    <span className="text-text-muted">⛳ {t('userStats.goal', { count: week.goalCount })}</span>
                )}
                {week.penaltyCount > 0 && (
                    <span className="text-text-muted">🚨 {t('userStats.penalty', { count: week.penaltyCount })}</span>
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


    // Load seasons on mount
    useEffect(() => {
        cacheService
            .getSeasons()
            .then((data) => {
                const sorted = [...data].sort(
                    (a, b) =>
                        new Date(b.startedOn).getTime() - new Date(a.startedOn).getTime(),
                )
                setSeasons(sorted)
            })
            .finally(() => setLoadingSeasons(false))
    }, [])

    // Load users on mount and auto-select first user
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

    // Fetch dashboard data on mount for scorer/penalty sections
    useEffect(() => {
        cacheService.getDashboardData()
            .then((data) => setDashboardData(data))
            .catch(() => setDashboardData(null))
    }, [])

    // When user changes, fetch all-seasons match history and cache for 5 minutes
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

    // When user or season changes, fetch breakdown for that specific (user, season) combination
    useEffect(() => {
        if (selectedUserId == null) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setBreakdownItems([])
            return
        }

        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoadingData(true)

        cacheService.getUserBreakdown(selectedUserId, selectedSeasonId ?? undefined)
            .then((breakdown) => setBreakdownItems(breakdown.items))
            .catch(() => setBreakdownItems([]))
            .finally(() => setLoadingData(false))
    }, [selectedUserId, selectedSeasonId])

    // ── Derived data from hierarchical matchData ────────────────────
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

    // Overall totals from season-level aggregates (includes UserSeasonAggregatedData)
    const overallTotalPlus = matchData.reduce((sum, s) => sum + s.totalPlus, 0)
    const overallTotalMinus = matchData.reduce((sum, s) => sum + s.totalMinus, 0)
    const overallGoalCount = matchData.reduce((sum, s) => sum + s.goalCount, 0)
    const overallPenaltyCount = matchData.reduce((sum, s) => sum + s.penaltyCount, 0)
    const overallMatchCount = allMatches.length

    // Best match: max(plus − minus), then most goals, then fewest penalties
    function compareBest(a: MatchHistoryItem, b: MatchHistoryItem): number {
        const netA = a.totalPlus - a.totalMinus
        const netB = b.totalPlus - b.totalMinus
        if (netB !== netA) return netB - netA
        if (b.goalCount !== a.goalCount) return b.goalCount - a.goalCount
        return a.penaltyCount - b.penaltyCount
    }

    // Worst match: max(minus − plus), then most penalties, then fewest goals
    function compareWorst(a: MatchHistoryItem, b: MatchHistoryItem): number {
        const netA = a.totalMinus - a.totalPlus
        const netB = b.totalMinus - b.totalPlus
        if (netB !== netA) return netB - netA
        if (b.penaltyCount !== a.penaltyCount) return b.penaltyCount - a.penaltyCount
        return a.goalCount - b.goalCount
    }

    const bestMatch = allMatches.length > 0
        ? [...allMatches].sort(compareBest)[0]
        : null

    const worstMatch = allMatches.length > 0
        ? [...allMatches].sort(compareWorst)[0]
        : null

    function getSeasonWeekLabel(m: MatchWithContext): string {
        return t('userStats.seasonWeekLabel', { season: m.seasonName, week: m.weekNumber })
    }

    // ── Best / Worst Week ───────────────────────────────────────────
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

    const bestWeek = allWeeks.length > 0
        ? [...allWeeks].sort(compareWeekBest)[0]
        : null

    const worstWeek = allWeeks.length > 0
        ? [...allWeeks].sort(compareWeekWorst)[0]
        : null

    return (
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
            <h1 className="text-2xl font-bold text-text">{t('userStats.title')}</h1>

            {/* ── Selectors row ──────────────────────────────────────────── */}
            <div className="flex items-center gap-4 flex-wrap">
                {loadingSeasons ? (
                    <div className="text-text-muted text-sm">{t('userStats.loadingSeasons')}</div>
                ) : (
                    <SeasonSelector
                        seasons={seasons}
                        selectedId={selectedSeasonId}
                        onChange={setSelectedSeasonId}
                    />
                )}

                {loadingUsers ? (
                    <div className="text-text-muted text-sm">{t('userStats.loadingPlayers')}</div>
                ) : (
                    <select
                        aria-label={t('userStats.selectPlayer')}
                        value={selectedUserId ?? ''}
                        onChange={(e) =>
                            setSelectedUserId(
                                e.target.value ? Number(e.target.value) : null,
                            )
                        }
                        className="bg-surface text-text rounded-lg px-3 py-1.5 text-sm border border-border focus:outline-none focus:border-primary transition-colors"
                    >
                        {users.length === 0 && (
                            <option value="">{t('userStats.noPlayers')}</option>
                        )}
                        {users.map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.name}
                            </option>
                        ))}
                    </select>
                )}

                {loadingData && (
                    <span className="text-text-muted text-sm">{t('userStats.loadingStats')}</span>
                )}
            </div>

            {/* ── Overall summary stats (includes aggregated data) ────── */}
            {matchData.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-surface rounded-xl p-4 text-center">
                        <p className="text-text-muted text-xs font-semibold uppercase tracking-wide">{t('userStats.totalPlus')}</p>
                        <p className="text-success text-2xl font-bold mt-1">+{overallTotalPlus}</p>
                    </div>
                    <div className="bg-surface rounded-xl p-4 text-center">
                        <p className="text-text-muted text-xs font-semibold uppercase tracking-wide">{t('userStats.totalMinus')}</p>
                        <p className="text-danger text-2xl font-bold mt-1">−{overallTotalMinus}</p>
                    </div>
                    <div className="bg-surface rounded-xl p-4 text-center">
                        <p className="text-text-muted text-xs font-semibold uppercase tracking-wide">{t('userStats.netPoints')}</p>
                        <p className={`text-2xl font-bold mt-1 ${overallTotalPlus - overallTotalMinus >= 0 ? 'text-success' : 'text-danger'}`}>
                            {overallTotalPlus - overallTotalMinus >= 0 ? '+' : ''}{overallTotalPlus - overallTotalMinus}
                        </p>
                    </div>
                    <div className="bg-surface rounded-xl p-4 text-center">
                        <p className="text-text-muted text-xs font-semibold uppercase tracking-wide">{t('userStats.goals')}</p>
                        <p className="text-text text-2xl font-bold mt-1">{overallGoalCount}</p>
                    </div>
                    <div className="bg-surface rounded-xl p-4 text-center">
                        <p className="text-text-muted text-xs font-semibold uppercase tracking-wide">{t('userStats.matchesPlayed')}</p>
                        <p className="text-text text-2xl font-bold mt-1">{overallMatchCount}</p>
                    </div>
                </div>
            )}

            {/* ── Top row: Penalty/Pointed bar chart + Minus-points pie ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-surface rounded-xl p-4">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted mb-3">
                        {t('userStats.penalties')}
                    </h2>
                    <PenaltyPointedChart items={breakdownItems} rosterPenaltyCount={overallPenaltyCount} />
                </div>
                <div className="bg-surface rounded-xl p-4">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted mb-3">
                        {t('userStats.minusBreakdown')}
                    </h2>
                    <MinusPointsPieChart items={breakdownItems} />
                </div>
            </div>

            {/* ── Middle row: week trend chart (full width) ─────────────── */}
            <div className="bg-surface rounded-xl p-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted mb-3">
                    {t('userStats.weekTrend')}
                </h2>
                <UserWeekTrendChart seasons={matchData} />
            </div>

            {/* ── Your Top Scorers + Penalty Leaders ───────────────────── */}
            {(userTopScorers.length > 0 || userPenaltyLeaders.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {userTopScorers.length > 0 && (
                        <div className="bg-surface rounded-xl p-4">
                            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted mb-3">
                                {t('userStats.yourTopScorers')}
                            </h2>
                            <TopScorersChart data={userTopScorers} hideLegend />
                        </div>
                    )}
                    {userPenaltyLeaders.length > 0 && (
                        <div className="bg-surface rounded-xl p-4">
                            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted mb-3">
                                {t('userStats.yourPenaltyLeaders')}
                            </h2>
                            <PenaltyLeadersChart data={userPenaltyLeaders} hideLegend />
                        </div>
                    )}
                </div>
            )}

            {/* ── Bottom row: best / worst match highlight cards ─────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <MatchCard title={t('userStats.bestMatch')} match={bestMatch} seasonWeekLabel={bestMatch ? getSeasonWeekLabel(bestMatch) : undefined} />
                <MatchCard title={t('userStats.worstMatch')} match={worstMatch} seasonWeekLabel={worstMatch ? getSeasonWeekLabel(worstMatch) : undefined} />
            </div>

            {/* ── Best / Worst week highlight cards ─────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <WeekCard title={t('userStats.bestWeek')} week={bestWeek} />
                <WeekCard title={t('userStats.worstWeek')} week={worstWeek} />
            </div>
        </div>
    )
}
