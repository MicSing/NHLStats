import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Season } from '../types/season'
import type { WeekGroup, WeeklyMatchUser, UserSeasonStats, TopRosterPlayer, UserSeasonTotals, HeadToHeadMatch, SeasonTotals } from '../types/stats'
import { CompletionType } from '../types/match'
import type { Match } from '../types/match'
import type { UserMatch, UserMatchPoint, UserMatchGoal, UserMatchPenalty } from '../types/userMatch'
import apiClient from '../services/apiClient'
import { cacheService } from '../services/cacheService'
import { statsService } from '../services/statsService'
import SeasonSelector from '../components/SeasonSelector'
import LoadingSpinner from '../components/LoadingSpinner'
import PageLayout from '../components/PageLayout'
import { useTranslation } from 'react-i18next'
import { teamLogoUrl } from '../utils/teamLogoUrl'
import CompletionBadge from '../components/CompletionBadge'
import { useIsAdmin } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useSeasonEventNotifications } from '../hooks/useSeasonEventNotifications'

interface MatchUserDetail {
    userMatchId: number
    userId: number
    points: UserMatchPoint[]
    goals: UserMatchGoal[]
    penalties: UserMatchPenalty[]
}

interface MatchExpandDetail {
    users: MatchUserDetail[]
}

function PointsTooltip({ points }: { points: UserMatchPoint[] }) {
    if (points.length === 0) return null
    return (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <div className="bg-surface border border-border rounded shadow-lg px-3 py-2 text-xs whitespace-nowrap">
                {points.map((p) => (
                    <div key={p.id} className="flex gap-2 justify-between">
                        <span>{p.pointReasonName}</span>
                        <span className="font-mono">×{p.count}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

function GoalsTooltip({ goals }: { goals: UserMatchGoal[] }) {
    if (goals.length === 0) return null
    const aggregated = Array.from(
        goals.reduce((map, g) => {
            const key = g.rosterPlayerId
            const existing = map.get(key)
            if (existing) {
                existing.count += g.count
            } else {
                map.set(key, { name: `${g.playerFirstName ?? ''} ${g.playerSurname ?? ''}`.trim(), count: g.count })
            }
            return map
        }, new Map<number, { name: string; count: number }>()).values()
    )
    return (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <div className="bg-surface border border-border rounded shadow-lg px-3 py-2 text-xs whitespace-nowrap">
                {aggregated.map((g) => (
                    <div key={g.name}>{g.name} ×{g.count}</div>
                ))}
            </div>
        </div>
    )
}

function PenaltiesTooltip({ penalties }: { penalties: UserMatchPenalty[] }) {
    if (penalties.length === 0) return null
    const aggregated = Array.from(
        penalties.reduce((map, p) => {
            const key = p.rosterPlayerId
            const existing = map.get(key)
            if (existing) {
                existing.count += p.count
            } else {
                map.set(key, { name: `${p.playerFirstName ?? ''} ${p.playerSurname ?? ''}`.trim(), count: p.count })
            }
            return map
        }, new Map<number, { name: string; count: number }>()).values()
    )
    return (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <div className="bg-surface border border-border rounded shadow-lg px-3 py-2 text-xs whitespace-nowrap">
                {aggregated.map((p) => (
                    <div key={p.name}>{p.name} ×{p.count}</div>
                ))}
            </div>
        </div>
    )
}

function BetCellTooltip({ betType, targetName }: { betType: string | null; targetName: string | null }) {
    if (!betType) return null
    const typeLabel = betType === 'TeamWin' ? 'Team Win' : betType === 'UserGoal' ? 'Goal' : 'Penalty'
    return (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <div className="bg-surface border border-border rounded shadow-lg px-3 py-2 text-xs whitespace-nowrap">
                <div>{typeLabel}{targetName ? `: ${targetName}` : ''}</div>
            </div>
        </div>
    )
}

function ExpandedMatchSection({
    users,
    detail,
    isLive,
}: {
    users: WeeklyMatchUser[]
    detail: MatchExpandDetail | undefined
    isLive?: boolean
}) {
    const { t } = useTranslation()
    return (
        <div className="border-t border-border bg-surface/40 rounded-b-lg px-4 py-2 overflow-visible">
            <table className="w-full text-xs">
                <thead>
                    <tr className="text-text-muted border-b border-border">
                        <th className="pb-1 text-left font-medium">{t('season.player')}</th>
                        <th className="pb-1 text-center font-medium">+</th>
                        <th className="pb-1 text-center font-medium">−</th>
                        <th className="pb-1 text-center font-medium">{t('season.goals')}</th>
                        <th className="pb-1 text-center font-medium">{t('season.penalties')}</th>
                        <th className="pb-1 text-center font-medium">{t('season.bet')}</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map((u) => {
                        const ud = detail?.users.find((d) => d.userId === u.userId)
                        const posPoints = ud?.points.filter((p) => p.pointType === 'Positive') ?? []
                        const negPoints = ud?.points.filter((p) => p.pointType === 'Negative') ?? []
                        return (
                            <tr key={u.userId} className="border-b border-border/50 last:border-b-0">
                                <td className="py-1 font-medium">{u.userName}</td>
                                <td className="py-1 text-center">
                                    <div className="relative group inline-block cursor-default">
                                        <span className="text-success">{u.totalPlus > 0 ? `+${u.totalPlus}` : '0'}</span>
                                        <PointsTooltip points={posPoints} />
                                    </div>
                                </td>
                                <td className="py-1 text-center">
                                    <div className="relative group inline-block cursor-default">
                                        <span className="text-danger">{u.totalMinus > 0 ? u.totalMinus : '0'}</span>
                                        <PointsTooltip points={negPoints} />
                                    </div>
                                </td>
                                <td className="py-1 text-center">
                                    <div className="relative group inline-block cursor-default">
                                        <span>{u.totalGoals}</span>
                                        {ud && <GoalsTooltip goals={ud.goals} />}
                                    </div>
                                </td>
                                <td className="py-1 text-center">
                                    <div className="relative group inline-block cursor-default">
                                        <span>{u.totalPenalties}</span>
                                        {ud && <PenaltiesTooltip penalties={ud.penalties} />}
                                    </div>
                                </td>
                                <td className="py-1 text-center">
                                    {u.betResult && u.betResult !== 'Cancelled' && u.betAmount != null ? (
                                        <div className="relative group inline-block cursor-default">
                                            <span className={
                                                u.betResult === 'Won' ? 'text-success font-medium' :
                                                u.betResult === 'Lost' ? 'text-danger' :
                                                'text-text-muted'
                                            }>
                                                {u.betResult === 'Won' && u.betWonAmount != null
                                                    ? `+${u.betWonAmount.toFixed(2)}€`
                                                    : u.betResult === 'Lost'
                                                        ? `-${u.betAmount.toFixed(2)}€`
                                                        : `${u.betAmount.toFixed(2)}€`}
                                            </span>
                                            {!isLive && <BetCellTooltip betType={u.betType ?? null} targetName={u.betTargetName ?? null} />}
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

function normalizeCompletionType(value: CompletionType | string | number | null | undefined): CompletionType {
    if (value === null || value === undefined) return CompletionType.None
    if (typeof value === 'number') {
        const completionValues: CompletionType[] = [
            CompletionType.None,
            CompletionType.RegularTime,
            CompletionType.Overtime,
            CompletionType.Shootout,
            CompletionType.InProgress,
        ]
        return completionValues.includes(value as CompletionType) ? (value as CompletionType) : CompletionType.None
    }

    switch (value.toLowerCase()) {
        case 'reg':
        case 'regular':
        case 'regulartime':
            return CompletionType.RegularTime
        case 'ot':
        case 'overtime':
            return CompletionType.Overtime
        case 'so':
        case 'shootout':
            return CompletionType.Shootout
        case 'inprogress':
        case 'in_progress':
        case 'live':
            return CompletionType.InProgress
        case 'none':
            return CompletionType.None
        default:
            return CompletionType.None
    }
}

function StatsTooltip({ users }: { users: { userId: number; userName: string; totalPlus: number; totalMinus: number; totalGoals: number; totalPenalties: number }[] }) {
    const { t } = useTranslation()
    if (!users || users.length === 0) return null
    return (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <div className="bg-surface border border-border rounded-lg shadow-lg px-4 py-3 min-w-[280px]">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="text-text-muted border-b border-border">
                            <th className="pb-1 text-left">{t('season.player')}</th>
                            <th className="pb-1 text-center">+</th>
                            <th className="pb-1 text-center">&minus;</th>
                            <th className="pb-1 text-center">{t('season.goals')}</th>
                            <th className="pb-1 text-center">{t('season.penalties')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((u) => (
                            <tr key={u.userId} className="border-b border-border/50 last:border-b-0">
                                <td className="py-1 font-medium">{u.userName}</td>
                                <td className="py-1 text-center text-success">
                                    {u.totalPlus > 0 ? `+${u.totalPlus}` : '0'}
                                </td>
                                <td className="py-1 text-center text-danger">
                                    {u.totalMinus > 0 ? u.totalMinus : '0'}
                                </td>
                                <td className="py-1 text-center">{u.totalGoals}</td>
                                <td className="py-1 text-center">{u.totalPenalties}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function aggregateWeekUsers(group: WeekGroup) {
    const map = new Map<number, { userId: number; userName: string; totalPlus: number; totalMinus: number; totalGoals: number; totalPenalties: number }>()
    for (const match of group.matches) {
        for (const u of match.users ?? []) {
            const existing = map.get(u.userId)
            if (existing) {
                existing.totalPlus += u.totalPlus
                existing.totalMinus += u.totalMinus
                existing.totalGoals += u.totalGoals
                existing.totalPenalties += u.totalPenalties
            } else {
                map.set(u.userId, { ...u })
            }
        }
    }
    return Array.from(map.values())
}

export default function SeasonPage() {
    const { seasonId: seasonIdParam } = useParams<{ seasonId?: string }>()
    const navigate = useNavigate()
    const seasonId = seasonIdParam ? Number(seasonIdParam) : null
    const { t } = useTranslation()
    const isAdmin = useIsAdmin()
    const toast = useToast()
    // Cache of all seasons' totals data (fetched once)
    const [seasonTotals, setSeasonTotals] = useState<SeasonTotals | null>(null)
    const [loadingTotals, setLoadingTotals] = useState(true)


    const [seasons, setSeasons] = useState<Season[]>([])
    const [weekGroups, setWeekGroups] = useState<WeekGroup[]>([])
    const [stats, setStats] = useState<UserSeasonStats[]>([])
    const [userTotals, setUserTotals] = useState<UserSeasonTotals[]>([])
    const [topScorer, setTopScorer] = useState<TopRosterPlayer | null>(null)
    const [topPenalized, setTopPenalized] = useState<TopRosterPlayer | null>(null)
    const [topPpScorer, setTopPpScorer] = useState<TopRosterPlayer | null>(null)
    const [topShScorer, setTopShScorer] = useState<TopRosterPlayer | null>(null)
    const [allMatches, setAllMatches] = useState<Match[]>([])
    const [loadingSeasons, setLoadingSeasons] = useState(true)
    const [loadingData, setLoadingData] = useState(false)
    const [expandedMatchId, setExpandedMatchId] = useState<number | null>(null)
    const [matchDetailCache, setMatchDetailCache] = useState<Map<number, MatchExpandDetail>>(new Map())
    const [reEvaluatingMatchId, setReEvaluatingMatchId] = useState<number | null>(null)
    const [aggregatedEntries, setAggregatedEntries] = useState<{ id: number; userId: number; userName: string; totalPlus: number; totalMinus: number; matchesPlayed: number }[]>([])
    const [h2hMatches, setH2hMatches] = useState<HeadToHeadMatch[]>([])
    const [loadingH2H, setLoadingH2H] = useState(false)
    const [h2hExpanded, setH2hExpanded] = useState(false)
    const { permission: notificationPermission, requestPermission: requestNotificationPermission } =
        useSeasonEventNotifications(seasonId)
    // Fetch all seasons' totals data once on mount
    useEffect(() => {
        apiClient
            .get<SeasonTotals>('/api/stats/season')
            .then(data => setSeasonTotals(data))
            .catch(err => console.error('Failed to fetch season totals:', err))
            .finally(() => setLoadingTotals(false))
    }, [])


    useEffect(() => {
        cacheService
            .getSeasons()
            .then((data) => {
                const sorted = [...data].sort(
                    (a, b) => new Date(b.startedOn).getTime() - new Date(a.startedOn).getTime(),
                )
                setSeasons(sorted)
                // If no seasonId in URL, navigate to the latest season
                if (!seasonId && sorted.length > 0) {
                    navigate(`/seasons/${sorted[0].id}`, { replace: true })
                }
            })
            .finally(() => setLoadingSeasons(false))
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!seasonId || !seasonTotals) return

        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoadingData(true)
        setH2hMatches([])
        setH2hExpanded(false)
        setLoadingH2H(false)
        setExpandedMatchId(null)
        setMatchDetailCache(new Map())
        // Find data for the selected season from cached totals
        const seasonUserData = seasonTotals.usersData.find(s => s.seasonId === seasonId)
        const seasonTopPlayers = seasonTotals.topRosterPlayers.find(s => s.seasonId === seasonId)


        Promise.all([
            apiClient.get<WeekGroup[]>(`/api/seasons/${seasonId}/stats/weekly`),
            cacheService.getUsers(),
            apiClient.get<Match[]>(`/api/seasons/${seasonId}/matches`),
            apiClient.get<{ id: number; userId: number; seasonId: number; totalPlus: number; totalMinus: number; matchesPlayed: number }[]>(`/api/seasons/${seasonId}/aggregated-data`),
        ])
            .then(([weeks, users, matches, aggData]) => {
                const userNameById = new Map(users.map(u => [u.id, u.name]))

                // Map SeasonUserData to UserSeasonStats format
                const seasonStats: UserSeasonStats[] = (seasonUserData?.usersData ?? []).map(ud => ({
                    userId: ud.userId,
                    userName: userNameById.get(ud.userId) ?? `User ${ud.userId}`,
                    totalPlus: ud.totalPlus,
                    totalMinus: ud.totalMinus,
                    earnings: ud.earnings,
                    bettingBalance: ud.bettingBalance,
                }))

                // Map to UserSeasonTotals format
                const totals: UserSeasonTotals[] = (seasonUserData?.usersData ?? []).map(ud => ({
                    userId: ud.userId,
                    userName: userNameById.get(ud.userId) ?? `User ${ud.userId}`,
                    totalGoals: ud.totalGoals,
                    totalPenalties: ud.totalPenalties,
                }))

                // Map top scorer (if exists)
                const scorer: TopRosterPlayer | null = seasonTopPlayers?.topScorer
                    ? {
                        rosterPlayerId: 0, // Not available in new format
                        firstName: seasonTopPlayers.topScorer.name.split(' ')[0] ?? '',
                        surname: seasonTopPlayers.topScorer.name.split(' ').slice(1).join(' ') || '',
                        count: seasonTopPlayers.topScorer.count,
                    }
                    : null

                // Map top penalized (if exists)
                const penalized: TopRosterPlayer | null = seasonTopPlayers?.topPenalty
                    ? {
                        rosterPlayerId: 0,
                        firstName: seasonTopPlayers.topPenalty.name.split(' ')[0] ?? '',
                        surname: seasonTopPlayers.topPenalty.name.split(' ').slice(1).join(' ') || '',
                        count: seasonTopPlayers.topPenalty.count,
                    }
                    : null

                const ppScorer: TopRosterPlayer | null = seasonTopPlayers?.topPpScorer
                    ? {
                        rosterPlayerId: 0,
                        firstName: seasonTopPlayers.topPpScorer.name.split(' ')[0] ?? '',
                        surname: seasonTopPlayers.topPpScorer.name.split(' ').slice(1).join(' ') || '',
                        count: seasonTopPlayers.topPpScorer.count,
                    }
                    : null

                const shScorer: TopRosterPlayer | null = seasonTopPlayers?.topShScorer
                    ? {
                        rosterPlayerId: 0,
                        firstName: seasonTopPlayers.topShScorer.name.split(' ')[0] ?? '',
                        surname: seasonTopPlayers.topShScorer.name.split(' ').slice(1).join(' ') || '',
                        count: seasonTopPlayers.topShScorer.count,
                    }
                    : null

                const aggEntries = aggData.map(e => ({
                    id: e.id,
                    userId: e.userId,
                    userName: userNameById.get(e.userId) ?? `User ${e.userId}`,
                    totalPlus: e.totalPlus,
                    totalMinus: e.totalMinus,
                    matchesPlayed: e.matchesPlayed,
                }))

                setWeekGroups(weeks)
                setStats(seasonStats)
                setTopScorer(scorer)
                setTopPenalized(penalized)
                setTopPpScorer(ppScorer)
                setTopShScorer(shScorer)
                setAllMatches(matches)
                setUserTotals(totals)
                setAggregatedEntries(aggEntries)
            })
            .finally(() => setLoadingData(false))
    }, [seasonId, seasonTotals])

    useEffect(() => {
        if (!seasonId || allMatches.length === 0) return

        const season = seasons.find((s) => s.id === seasonId)
        if (!season?.hostedTeamId) return

        const unplayed = allMatches
            .filter((m) => m.matchDate === null)
            .sort((a, b) => a.matchNumber - b.matchNumber)
        if (unplayed.length === 0) return

        const upNext = unplayed[0]
        const opponentTeamId =
            upNext.homeTeamId === season.hostedTeamId ? upNext.awayTeamId : upNext.homeTeamId

        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoadingH2H(true)
        statsService
            .getHeadToHead(opponentTeamId, season.hostedTeamId)
            .then((matches) => setH2hMatches(matches))
            .catch(() => setH2hMatches([]))
            .finally(() => setLoadingH2H(false))
    }, [allMatches]) // eslint-disable-line react-hooks/exhaustive-deps

    const fetchMatchDetail = async (matchId: number) => {
        if (!seasonId || matchDetailCache.has(matchId)) return
        try {
            const userMatches = await apiClient.get<UserMatch[]>(
                `/api/seasons/${seasonId}/matches/${matchId}/usermatches`
            )
            const userDetails = await Promise.all(
                userMatches.map(async (um) => {
                    const [points, goals, penalties] = await Promise.all([
                        apiClient.get<UserMatchPoint[]>(`/api/usermatches/${um.id}/points`),
                        apiClient.get<UserMatchGoal[]>(`/api/usermatches/${um.id}/goals`),
                        apiClient.get<UserMatchPenalty[]>(`/api/usermatches/${um.id}/penalties`),
                    ])
                    return { userMatchId: um.id, userId: um.userId, points, goals, penalties }
                })
            )
            setMatchDetailCache((prev) => {
                const next = new Map(prev)
                next.set(matchId, { users: userDetails })
                return next
            })
        } catch {
            // silently ignore fetch errors
        }
    }

    const toggleExpand = async (matchId: number) => {
        if (expandedMatchId === matchId) {
            setExpandedMatchId(null)
        } else {
            setExpandedMatchId(matchId)
            await fetchMatchDetail(matchId)
        }
    }

    const reEvaluateBets = async (matchId: number) => {
        setReEvaluatingMatchId(matchId)
        try {
            await apiClient.post(`/api/admin/matches/${matchId}/re-evaluate-bets`, {})
            toast.success(t('season.reEvaluateSuccess'))
        } catch {
            toast.error(t('season.reEvaluateError'))
        } finally {
            setReEvaluatingMatchId(null)
        }
    }

    const handleSeasonChange = (id: number | null) => {
        if (id === null) navigate('/seasons')
        else navigate(`/seasons/${id}`)
    }

    return (
        <PageLayout>
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <h1 className="text-2xl font-bold text-primary">{t('season.title')}</h1>
                    {!loadingSeasons && (
                        <SeasonSelector
                            seasons={seasons}
                            selectedId={seasonId}
                            onChange={handleSeasonChange}
                        />
                    )}
                    <Link
                        to="/dashboard"
                        className="ml-auto text-sm text-text-muted hover:text-primary transition-colors"
                    >
                        {t('season.dashboardLink')}
                    </Link>
                </div>

                {seasonId && notificationPermission === 'default' && (
                    <div className="mb-4 flex items-center justify-between rounded border border-border bg-surface p-3 text-sm">
                        <span className="text-text-muted">{t('notifications.banner')}</span>
                        <button
                            type="button"
                            onClick={() => { void requestNotificationPermission() }}
                            className="ml-3 rounded bg-primary px-3 py-1 text-xs font-medium text-white hover:opacity-90"
                        >
                            {t('notifications.enable')}
                        </button>
                    </div>
                )}
                {seasonId && notificationPermission === 'denied' && (
                    <div className="mb-4 rounded border border-border bg-surface p-3 text-xs text-text-muted">
                        {t('notifications.blocked')}
                    </div>
                )}

                {!seasonId && (
                    <p className="text-text-muted">{t('season.selectSeason')}</p>
                )}

                {seasonId && (loadingTotals || loadingData) && <LoadingSpinner />}

                {seasonId && !loadingTotals && !loadingData && (
                    <>
                        {/* User Stats Table */}
                        {stats.length > 0 && (
                            <section className="mb-8" aria-label="User stats">
                                <h2 className="text-lg font-semibold mb-3 text-primary/80">
                                    {t('season.playerStats')}
                                </h2>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-text-muted border-b border-border">
                                                <th className="pb-2">{t('season.player')}</th>
                                                <th className="pb-2">+</th>
                                                <th className="pb-2">−</th>
                                                <th className="pb-2">{t('season.goals')}</th>
                                                <th className="pb-2">{t('season.penalties')}</th>
                                                <th className="pb-2">{t('season.earnings')}</th>
                                                <th className="pb-2">{t('season.betBalance')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {stats.map((s) => {
                                                const totals = userTotals.find((t) => t.userId === s.userId)
                                                return (
                                                    <tr key={s.userId} className="border-b border-border">
                                                        <td className="py-2">{s.userName}</td>
                                                        <td className="py-2 text-success">{s.totalPlus}</td>
                                                        <td className="py-2 text-danger">{s.totalMinus}</td>
                                                        <td className="py-2 text-primary">{totals?.totalGoals ?? 0}</td>
                                                        <td className="py-2 text-warning">{totals?.totalPenalties ?? 0}</td>
                                                        <td className="py-2">{s.earnings.toFixed(2)} €</td>
                                                        <td className="py-2 text-primary">{s.bettingBalance.toFixed(2)} €</td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        )}

                        {/* Aggregated Entries */}
                        {aggregatedEntries.length > 0 && (
                            <section className="mb-8" aria-label={t('season.aggregatedEntries')}>
                                <h2 className="text-lg font-semibold mb-3 text-primary/80">
                                    {t('season.aggregatedEntries')}
                                </h2>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-text-muted border-b border-border">
                                                <th className="pb-2">{t('season.player')}</th>
                                                <th className="pb-2">+</th>
                                                <th className="pb-2">−</th>
                                                <th className="pb-2">{t('match.matchesPlayed', { defaultValue: 'Matches Played' })}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {aggregatedEntries.map((e) => (
                                                <tr key={e.id} className="border-b border-border">
                                                    <td className="py-2">{e.userName}</td>
                                                    <td className="py-2 text-success">{e.totalPlus}</td>
                                                    <td className="py-2 text-danger">{e.totalMinus}</td>
                                                    <td className="py-2">{e.matchesPlayed}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        )}

                        {/* Top Players */}
                        {(topScorer ?? topPenalized ?? topPpScorer ?? topShScorer) && (
                            <section className="mb-8 flex gap-6" aria-label="Top players">
                                {topScorer && (
                                    <div className="card p-4">
                                        <h3 className="text-sm text-text-muted mb-1">{t('season.topScorer')}</h3>
                                        <p className="font-semibold">
                                            {topScorer.firstName} {topScorer.surname}
                                        </p>
                                        <p className="text-sm text-text-muted">
                                            {t('season.goals_count', { count: topScorer.count })}
                                        </p>
                                    </div>
                                )}
                                {topPpScorer && (
                                    <div className="card p-4">
                                        <h3 className="text-sm text-text-muted mb-1">
                                            {t('season.topPowerPlayScorer')}
                                        </h3>
                                        <p className="font-semibold">
                                            {topPpScorer.firstName} {topPpScorer.surname}
                                        </p>
                                        <p className="text-sm text-text-muted">
                                            {t('season.goals_count', { count: topPpScorer.count })}
                                        </p>
                                    </div>
                                )}
                                {topShScorer && (
                                    <div className="card p-4">
                                        <h3 className="text-sm text-text-muted mb-1">
                                            {t('season.topShortHandedScorer')}
                                        </h3>
                                        <p className="font-semibold">
                                            {topShScorer.firstName} {topShScorer.surname}
                                        </p>
                                        <p className="text-sm text-text-muted">
                                            {t('season.goals_count', { count: topShScorer.count })}
                                        </p>
                                    </div>
                                )}
                                {topPenalized && (
                                    <div className="card p-4">
                                        <h3 className="text-sm text-text-muted mb-1">
                                            {t('season.mostPenalized')}
                                        </h3>
                                        <p className="font-semibold">
                                            {topPenalized.firstName} {topPenalized.surname}
                                        </p>
                                        <p className="text-sm text-text-muted">
                                            {t('season.penalties_count', { count: topPenalized.count })}
                                        </p>
                                    </div>
                                )}
                            </section>
                        )}

                        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(22rem,1fr)] xl:grid-cols-[minmax(0,1.35fr)_minmax(24rem,1fr)]">
                            <div>
                                {/* Weekly Matches */}
                                {weekGroups.length > 0 && (
                                    <section aria-label="Weekly matches">
                                        <h2 className="text-lg font-semibold mb-4 text-primary">
                                            {t('season.matchesByWeek')}
                                        </h2>
                                        {(() => {
                                            const matchNumberById = new Map(allMatches.map((m) => [m.id, m.matchNumber]))
                                            return weekGroups.map((group) => {
                                            const season = seasons.find((s) => s.id === seasonId)
                                            const hostedTeamId = season?.hostedTeamId ?? null

                                            return (
                                                <div key={group.weekNumber} className="mb-6">
                                                    <div className="flex items-center justify-between mb-2 border-b border-border pb-1">
                                                        <h3 className="text-sm text-text-muted">
                                                            {t('season.week', { number: group.weekNumber })}
                                                        </h3>
                                                        <div className="relative group flex items-center gap-2 text-xs">
                                                            <StatsTooltip users={aggregateWeekUsers(group)} />
                                                            <span className="px-2 py-0.5 rounded bg-success/20 text-success font-medium cursor-default">
                                                                +{group.totalPlus}
                                                            </span>
                                                            <span className="px-2 py-0.5 rounded bg-danger/20 text-danger font-medium cursor-default">
                                                                −{group.totalMinus}
                                                            </span>
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

                                                            // Inline background avoids CSS variable opacity issues
                                                            const bgStyle = {
                                                                backgroundColor: isWin
                                                                    ? 'rgba(46, 147, 90, 0.18)'
                                                                    : isLoss
                                                                        ? 'rgba(197, 48, 48, 0.18)'
                                                                        : undefined,
                                                            }

                                                            const homeLogo = teamLogoUrl(m.homeTeamShortName ?? '')
                                                            const awayLogo = teamLogoUrl(m.awayTeamShortName ?? '')

                                                            const isCompleted =
                                                                completionType === CompletionType.RegularTime ||
                                                                completionType === CompletionType.Overtime ||
                                                                completionType === CompletionType.Shootout

                                                            const matchNumber = matchNumberById.get(m.matchId)

                                                            const matchInner = (
                                                                <>
                                                                    <span className="text-xs text-text-muted font-mono w-8 flex-shrink-0">
                                                                        {matchNumber != null ? `#${matchNumber}` : ''}
                                                                    </span>
                                                                    <img
                                                                        src={homeLogo}
                                                                        alt={m.homeTeamShortName ?? ''}
                                                                        className="w-7 h-7 object-contain flex-shrink-0"
                                                                        onError={(e) => { ;(e.target as HTMLImageElement).style.display = 'none' }}
                                                                    />
                                                                    <span className="font-semibold text-sm w-9 flex-shrink-0">{m.homeTeamShortName}</span>
                                                                    <span className="font-mono text-lg">{m.homeScore}</span>
                                                                    <span className="text-text-muted font-mono text-lg">–</span>
                                                                    <span className="font-mono text-lg">{m.awayScore}</span>
                                                                    {completionType !== CompletionType.None && (
                                                                        <CompletionBadge type={completionType} />
                                                                    )}
                                                                    <span className="font-semibold text-sm w-9 flex-shrink-0">{m.awayTeamShortName}</span>
                                                                    <img
                                                                        src={awayLogo}
                                                                        alt={m.awayTeamShortName ?? ''}
                                                                        className="w-7 h-7 object-contain flex-shrink-0"
                                                                        onError={(e) => { ;(e.target as HTMLImageElement).style.display = 'none' }}
                                                                    />
                                                                </>
                                                            )

                                                            const isExpanded = expandedMatchId === m.matchId
                                                            const detail = matchDetailCache.get(m.matchId)

                                                            if (isAdmin) {
                                                                return (
                                                                    <div key={m.matchId}>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => void toggleExpand(m.matchId)}
                                                                            className="flex items-center gap-3 card rounded-lg px-4 py-2.5 w-full text-left hover:brightness-110 transition-all"
                                                                            style={bgStyle}
                                                                        >
                                                                            {matchInner}
                                                                            <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                                                                                <Link
                                                                                    to={`/seasons/${seasonId}/matches/${m.matchId}`}
                                                                                    className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
                                                                                    onClick={(e) => e.stopPropagation()}
                                                                                >
                                                                                    {t('season.editMatch')}
                                                                                </Link>
                                                                                {isCompleted && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={(e) => { e.stopPropagation(); void reEvaluateBets(m.matchId) }}
                                                                                        disabled={reEvaluatingMatchId === m.matchId}
                                                                                        className="text-xs px-2 py-0.5 rounded bg-warning/20 text-warning hover:bg-warning/30 transition-colors disabled:opacity-50"
                                                                                    >
                                                                                        {reEvaluatingMatchId === m.matchId ? '…' : t('season.reEvaluateBets')}
                                                                                    </button>
                                                                                )}
                                                                                <span className="text-text-muted text-xs">{isExpanded ? '▲' : '▼'}</span>
                                                                            </div>
                                                                        </button>
                                                                        {isExpanded && (
                                                                            <ExpandedMatchSection
                                                                                users={m.users ?? []}
                                                                                detail={detail}
                                                                                isLive={completionType === CompletionType.InProgress}
                                                                            />
                                                                        )}
                                                                    </div>
                                                                )
                                                            }

                                                            return (
                                                                <div key={m.matchId}>
                                                                    <div className="relative group">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => void toggleExpand(m.matchId)}
                                                                            className="flex items-center gap-3 card rounded-lg px-4 py-2.5 w-full text-left hover:brightness-110 transition-all"
                                                                            style={bgStyle}
                                                                        >
                                                                            {matchInner}
                                                                            <span className="ml-auto text-text-muted text-xs flex-shrink-0">
                                                                                {isExpanded ? '▲' : '▼'}
                                                                            </span>
                                                                        </button>
                                                                    </div>
                                                                    {isExpanded && (
                                                                        <ExpandedMatchSection
                                                                            users={m.users ?? []}
                                                                            detail={detail}
                                                                            isLive={completionType === CompletionType.InProgress}
                                                                        />
                                                                    )}
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )
                                        })
                                        })()}
                                    </section>
                                )}
                            </div>

                            <div>
                                {/* Up Next + Upcoming unplayed matches */}
                                {(() => {
                                    const unplayed = allMatches
                                        .filter((m) => m.matchDate === null)
                                        .sort((a, b) => a.matchNumber - b.matchNumber)
                                    if (unplayed.length === 0) return null
                                    const upNext = unplayed[0]
                                    const upcoming = unplayed.slice(1)
                                    const season = seasons.find((s) => s.id === seasonId)
                                    const hostedTeamId = season?.hostedTeamId ?? null
                                    return (
                                        <>
                                            <section aria-label="Up next match">
                                                <h2 className="text-lg font-semibold mb-3 text-primary">
                                                    {t('season.upNext')}
                                                </h2>
                                                <Link
                                                    to={`/seasons/${seasonId}/matches/${upNext.id}`}
                                                    className="block card border-primary/40 rounded-xl px-6 py-5 hover:bg-primary/10 transition-colors"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="text-center flex-1">
                                                            <p className="text-lg font-bold">
                                                                {upNext.homeTeamName}
                                                            </p>
                                                        </div>
                                                        <div className="text-center px-6">
                                                            <p className="text-xs text-text-muted mb-1">
                                                                {t('season.match', { number: upNext.matchNumber })}
                                                            </p>
                                                            <p className="text-2xl font-mono text-text-muted">
                                                                {t('season.vs')}
                                                            </p>
                                                        </div>
                                                        <div className="text-center flex-1">
                                                            <p className="text-lg font-bold">
                                                                {upNext.awayTeamName}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </Link>
                                            </section>

                                            {/* Head-to-head with upcoming opponent */}
                                            {hostedTeamId && (
                                                <div className="mt-4" aria-label="Previous meetings">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <h3 className="text-base font-semibold text-primary/80">
                                                            {t('season.previousMeetings')}
                                                        </h3>
                                                        {!loadingH2H && h2hMatches.length > 0 && (
                                                            <button
                                                                onClick={() => setH2hExpanded((prev) => !prev)}
                                                                className="text-xs text-primary hover:underline"
                                                            >
                                                                {h2hExpanded
                                                                    ? t('season.hide')
                                                                    : t('season.showMatches', { count: h2hMatches.length })}
                                                            </button>
                                                        )}
                                                    </div>

                                                    {loadingH2H && (
                                                        <div className="flex items-center gap-2 text-text-muted text-sm py-2">
                                                            <svg
                                                                className="animate-spin w-4 h-4 text-primary"
                                                                xmlns="http://www.w3.org/2000/svg"
                                                                fill="none"
                                                                viewBox="0 0 24 24"
                                                            >
                                                                <circle
                                                                    className="opacity-25"
                                                                    cx="12"
                                                                    cy="12"
                                                                    r="10"
                                                                    stroke="currentColor"
                                                                    strokeWidth="4"
                                                                />
                                                                <path
                                                                    className="opacity-75"
                                                                    fill="currentColor"
                                                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                                                />
                                                            </svg>
                                                            <span>{t('common.loading')}</span>
                                                        </div>
                                                    )}

                                                    {!loadingH2H && h2hMatches.length === 0 && (
                                                        <p className="text-sm text-text-muted py-2">
                                                            {t('common.noData')}
                                                        </p>
                                                    )}

                                                    {!loadingH2H && h2hMatches.length > 0 && h2hExpanded && (
                                                        <div className="space-y-2">
                                                            {h2hMatches.map((h2hMatch) => {
                                                                const homeLogo = teamLogoUrl(h2hMatch.homeTeamShortName)
                                                                const awayLogo = teamLogoUrl(h2hMatch.awayTeamShortName)
                                                                const ct = normalizeCompletionType(h2hMatch.completionType)
                                                                return (
                                                                    <div
                                                                        key={h2hMatch.matchId}
                                                                        className="card rounded-lg px-4 py-3"
                                                                    >
                                                                        {/* Score row */}
                                                                        <div className="flex items-center gap-2 text-sm flex-wrap">
                                                                            <img
                                                                                src={homeLogo}
                                                                                alt={h2hMatch.homeTeamShortName}
                                                                                className="w-6 h-6 object-contain flex-shrink-0"
                                                                                onError={(e) => {
                                                                                    ; (e.target as HTMLImageElement).style.display = 'none'
                                                                                }}
                                                                            />
                                                                            <span className="font-semibold w-8 flex-shrink-0">
                                                                                {h2hMatch.homeTeamShortName}
                                                                            </span>
                                                                            <span className="font-mono font-bold">
                                                                                {h2hMatch.homeScore}
                                                                            </span>
                                                                            <span className="text-text-muted font-mono">–</span>
                                                                            <span className="font-mono font-bold">
                                                                                {h2hMatch.awayScore}
                                                                            </span>
                                                                            <span className="font-semibold w-8 flex-shrink-0">
                                                                                {h2hMatch.awayTeamShortName}
                                                                            </span>
                                                                            <img
                                                                                src={awayLogo}
                                                                                alt={h2hMatch.awayTeamShortName}
                                                                                className="w-6 h-6 object-contain flex-shrink-0"
                                                                                onError={(e) => {
                                                                                    ; (e.target as HTMLImageElement).style.display = 'none'
                                                                                }}
                                                                            />
                                                                            {ct !== CompletionType.None && (
                                                                                <CompletionBadge type={ct} />
                                                                            )}
                                                                            <span className="text-xs text-text-muted ml-auto whitespace-nowrap">
                                                                                {new Date(h2hMatch.matchDate).toLocaleDateString()}{' '}
                                                                                · {h2hMatch.seasonName}
                                                                            </span>
                                                                        </div>
                                                                        {/* Per-user +/- row */}
                                                                        {h2hMatch.userResults.length > 0 && (
                                                                            <div className="flex flex-wrap gap-3 mt-1.5">
                                                                                {h2hMatch.userResults.map((ur) => (
                                                                                    <span key={ur.userId} className="text-xs">
                                                                                        <span className="text-text-muted">
                                                                                            {ur.userName}:
                                                                                        </span>{' '}
                                                                                        <span className="text-success">
                                                                                            +{ur.totalPlus}
                                                                                        </span>
                                                                                        {' / '}
                                                                                        <span className="text-danger">
                                                                                            −{ur.totalMinus}
                                                                                        </span>
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {upcoming.length > 0 && (
                                                <section className="mt-6" aria-label="Upcoming matches">
                                                    <h2 className="text-lg font-semibold mb-3 text-primary">
                                                        {t('season.upcomingMatches')}
                                                    </h2>
                                                    <div className="space-y-2">
                                                        {upcoming.map((m) => (
                                                            <Link
                                                                key={m.id}
                                                                to={`/seasons/${seasonId}/matches/${m.id}`}
                                                                className="flex items-center justify-between card rounded-lg px-4 py-3 hover:bg-surface/80 transition-colors"
                                                            >
                                                                <span className="text-xs text-text-muted w-8">
                                                                    #{m.matchNumber}
                                                                </span>
                                                                <span className="flex-1">
                                                                    {m.homeTeamName} {t('season.vs')} {m.awayTeamName}
                                                                </span>
                                                            </Link>
                                                        ))}
                                                    </div>
                                                </section>
                                            )}
                                        </>
                                    )
                                })()}
                            </div>
                        </div>

                    </>
                )}
            </div>
        </PageLayout>
    )
}
