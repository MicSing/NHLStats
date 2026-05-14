import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
    Star, Lightning, Shield, WarningOctagon,
    BellRinging, CaretDown, Layout, PencilSimple, ArrowsClockwise,
} from '@phosphor-icons/react'
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
import { useIsDesktop } from '../hooks/useIsDesktop'

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
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 w-60">
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

function PointsTooltip({ points }: { points: UserMatchPoint[] }) {
    if (points.length === 0) return null
    return (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <div className="bg-surface border border-border rounded shadow-card px-3 py-2 text-xs whitespace-nowrap">
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
            <div className="bg-surface border border-border rounded shadow-card px-3 py-2 text-xs whitespace-nowrap">
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
            <div className="bg-surface border border-border rounded shadow-card px-3 py-2 text-xs whitespace-nowrap">
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
            <div className="bg-surface border border-border rounded shadow-card px-3 py-2 text-xs whitespace-nowrap">
                <div>{typeLabel}{targetName ? `: ${targetName}` : ''}</div>
            </div>
        </div>
    )
}

function ExpandedMatchSection({
    users,
    detail,
}: {
    users: WeeklyMatchUser[]
    detail: MatchExpandDetail | undefined
}) {
    const { t } = useTranslation()

    return (
        <div className="border-t border-border bg-bg/50">
            <table className="w-full text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-text-muted border-b border-border bg-bg/80">
                    <tr>
                        <th className="py-2.5 px-4 font-bold text-left">{t('season.player')}</th>
                        <th className="py-2.5 px-3 font-bold text-center w-12">+</th>
                        <th className="py-2.5 px-3 font-bold text-center w-12">−</th>
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
    const isDesktop = useIsDesktop()

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
                if (!seasonId && sorted.length > 0) {
                    navigate(`/seasons/${sorted[0].id}`, { replace: true })
                }
            })
            .finally(() => setLoadingSeasons(false))
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!seasonId || !seasonTotals) return

        setLoadingData(true)
        setH2hMatches([])
        setH2hExpanded(false)
        setLoadingH2H(false)
        setExpandedMatchId(null)
        setMatchDetailCache(new Map())
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

                const seasonStats: UserSeasonStats[] = (seasonUserData?.usersData ?? []).map(ud => ({
                    userId: ud.userId,
                    userName: userNameById.get(ud.userId) ?? `User ${ud.userId}`,
                    totalPlus: ud.totalPlus,
                    totalMinus: ud.totalMinus,
                    earnings: ud.earnings,
                    bettingBalance: ud.bettingBalance,
                }))

                const totals: UserSeasonTotals[] = (seasonUserData?.usersData ?? []).map(ud => ({
                    userId: ud.userId,
                    userName: userNameById.get(ud.userId) ?? `User ${ud.userId}`,
                    totalGoals: ud.totalGoals,
                    totalPenalties: ud.totalPenalties,
                }))

                const scorer: TopRosterPlayer | null = seasonTopPlayers?.topScorer
                    ? {
                        rosterPlayerId: 0,
                        firstName: seasonTopPlayers.topScorer.name.split(' ')[0] ?? '',
                        surname: seasonTopPlayers.topScorer.name.split(' ').slice(1).join(' ') || '',
                        count: seasonTopPlayers.topScorer.count,
                    }
                    : null

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
            // silently ignore
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

    const currentSeason = seasons.find((s) => s.id === seasonId) ?? null

    const hostedTeamShortName = (() => {
        if (!currentSeason?.hostedTeamId) return null
        for (const group of weekGroups) {
            for (const m of group.matches) {
                if (m.homeTeamId === currentSeason.hostedTeamId) return m.homeTeamShortName
                if (m.awayTeamId === currentSeason.hostedTeamId) return m.awayTeamShortName
            }
        }
        return null
    })()

    const hostedStats = (() => {
        const htId = currentSeason?.hostedTeamId
        if (!htId) return null
        let W = 0, L = 0, OTL = 0, OT = 0
        let winsHome = 0, winsAway = 0, lossesHome = 0, lossesAway = 0
        for (const m of allMatches) {
            const ct = normalizeCompletionType(m.completionType)
            const done =
                ct === CompletionType.RegularTime ||
                ct === CompletionType.Overtime ||
                ct === CompletionType.Shootout
            if (!done) continue
            const isHome = m.homeTeamId === htId
            const isAway = m.awayTeamId === htId
            if (!isHome && !isAway) continue
            const hs = isHome ? m.homeScore : m.awayScore
            const os = isHome ? m.awayScore : m.homeScore
            const isOTGame = ct === CompletionType.Overtime || ct === CompletionType.Shootout
            if (isOTGame) OT++
            if (hs > os) { W++; if (isHome) winsHome++; else winsAway++ }
            else if (hs < os) {
                if (isOTGame) OTL++; else L++
                if (isHome) lossesHome++; else lossesAway++
            }
        }
        return { W, L, OTL, OT, winsHome, winsAway, lossesHome, lossesAway }
    })()

    return (
        <PageLayout>
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <header className="flex items-center justify-between pb-4 border-b border-border mb-6">
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl font-bold tracking-tight">{t('season.title')}</h1>
                        {!loadingSeasons && (
                            <SeasonSelector
                                seasons={seasons}
                                selectedId={seasonId}
                                onChange={handleSeasonChange}
                            />
                        )}
                    </div>
                    <Link
                        to="/dashboard"
                        className="flex items-center gap-2 text-sm font-semibold text-text-muted hover:text-primary transition-colors"
                    >
                        <Layout size={16} />
                        <span>{t('season.dashboardLink')}</span>
                    </Link>
                </header>

                {/* Notification banners */}
                {isDesktop && seasonId && notificationPermission === 'default' && (
                    <div className="mb-4 bg-surface border-l-4 border-l-primary border border-border rounded-lg p-3 px-5 flex items-center justify-between shadow-card">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <BellRinging size={16} className="text-primary" />
                            </div>
                            <p className="text-sm text-text-muted font-medium">{t('notifications.banner')}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => { void requestNotificationPermission() }}
                            className="ml-4 bg-primary hover:bg-primary-hover text-white text-xs font-bold py-2 px-5 rounded transition-colors uppercase tracking-wide flex-shrink-0"
                        >
                            {t('notifications.enable')}
                        </button>
                    </div>
                )}
                {isDesktop && seasonId && notificationPermission === 'denied' && (
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
                                <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted mb-3">
                                    {t('season.playerStats', { defaultValue: 'Player Stats' })}
                                </h2>
                                <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-card">
                                    <table className="w-full text-sm">
                                        <thead className="bg-bg border-b border-border text-[11px] uppercase tracking-wider text-text-muted">
                                            <tr>
                                                <th className="py-3 px-5 font-semibold text-left">{t('season.player')}</th>
                                                <th className="py-3 px-5 font-semibold text-center">+</th>
                                                <th className="py-3 px-5 font-semibold text-center">−</th>
                                                <th className="py-3 px-5 font-semibold text-center">{t('season.goals')}</th>
                                                <th className="py-3 px-5 font-semibold text-center">{t('season.penalties')}</th>
                                                <th className="py-3 px-5 font-semibold text-center">{t('season.earnings', { defaultValue: 'Earnings' })}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {stats.map((s) => {
                                                const totals = userTotals.find((t) => t.userId === s.userId)
                                                return (
                                                    <tr key={s.userId} className="hover:bg-bg/60 transition-colors group">
                                                        <td className="py-3 px-5 font-semibold">{s.userName}</td>
                                                        <td className="py-3 px-5 text-center text-success font-bold tabular-nums">{s.totalPlus}</td>
                                                        <td className="py-3 px-5 text-center text-danger font-bold tabular-nums">{s.totalMinus}</td>
                                                        <td className="py-3 px-5 text-center text-text-muted group-hover:text-text transition-colors font-medium tabular-nums">{totals?.totalGoals ?? 0}</td>
                                                        <td className="py-3 px-5 text-center text-text-muted group-hover:text-text transition-colors font-medium tabular-nums">{totals?.totalPenalties ?? 0}</td>
                                                        <td className="py-3 px-5 text-center text-text-muted group-hover:text-text transition-colors font-medium tabular-nums">{s.earnings.toFixed(2)} €</td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        )}

                        {/* Hosted Team Record */}
                        {currentSeason?.hostedTeamId && hostedStats && (
                            <section className="mb-8" aria-label="Hosted team record">
                                <div className="bg-surface border border-border rounded-lg shadow-card">
                                    <div className="p-5 flex items-center gap-4 border-b border-border bg-bg rounded-t-lg">
                                        {hostedTeamShortName && (
                                            <img
                                                src={teamLogoUrl(hostedTeamShortName)}
                                                alt={currentSeason.hostedTeamName ?? ''}
                                                className="w-10 h-10 object-contain"
                                                onError={(e) => { ;(e.target as HTMLImageElement).style.display = 'none' }}
                                            />
                                        )}
                                        <div>
                                            <div className="text-[10px] text-text-muted uppercase tracking-widest font-bold mb-0.5">Team Overview</div>
                                            <h2 className="text-xl font-bold">{currentSeason.hostedTeamName}</h2>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-border">
                                        <div className="p-5 flex justify-around items-center">
                                            <div className="text-center">
                                                <div className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1">W</div>
                                                <div className="text-3xl font-bold text-success tabular-nums">{hostedStats.W}</div>
                                            </div>
                                            <div className="w-px h-10 bg-border" />
                                            <div className="text-center">
                                                <div className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1">L</div>
                                                <div className="text-3xl font-bold text-danger tabular-nums">{hostedStats.L}</div>
                                            </div>
                                        </div>
                                        <div className="p-5 flex justify-around items-center">
                                            <div className="text-center">
                                                <div className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1">OTL</div>
                                                <div className="text-2xl font-bold tabular-nums">{hostedStats.OTL}</div>
                                            </div>
                                            <div className="w-px h-8 bg-border" />
                                            <div className="text-center">
                                                <div className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1">OT/SO</div>
                                                <div className="text-2xl font-bold text-primary tabular-nums">{hostedStats.OT}</div>
                                            </div>
                                        </div>
                                        <div className="p-5 flex justify-around items-center">
                                            <div className="text-center">
                                                <div className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1">{t('season.winsHome')}</div>
                                                <div className="text-xl font-bold text-success tabular-nums">{hostedStats.winsHome}</div>
                                            </div>
                                            <div className="w-px h-8 bg-border" />
                                            <div className="text-center">
                                                <div className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1">{t('season.winsAway')}</div>
                                                <div className="text-xl font-bold text-success tabular-nums">{hostedStats.winsAway}</div>
                                            </div>
                                        </div>
                                        <div className="p-5 flex justify-around items-center">
                                            <div className="text-center">
                                                <div className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1">{t('season.lossesHome')}</div>
                                                <div className="text-xl font-bold text-danger tabular-nums">{hostedStats.lossesHome}</div>
                                            </div>
                                            <div className="w-px h-8 bg-border" />
                                            <div className="text-center">
                                                <div className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1">{t('season.lossesAway')}</div>
                                                <div className="text-xl font-bold text-danger tabular-nums">{hostedStats.lossesAway}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* Aggregated Entries */}
                        {aggregatedEntries.length > 0 && (
                            <section className="mb-8" aria-label={t('season.aggregatedEntries')}>
                                <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted mb-3">
                                    {t('season.aggregatedEntries')}
                                </h2>
                                <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-card">
                                    <table className="w-full text-sm">
                                        <thead className="bg-bg border-b border-border text-[11px] uppercase tracking-wider text-text-muted">
                                            <tr>
                                                <th className="py-3 px-5 font-semibold text-left">{t('season.player')}</th>
                                                <th className="py-3 px-5 font-semibold text-center">+</th>
                                                <th className="py-3 px-5 font-semibold text-center">−</th>
                                                <th className="py-3 px-5 font-semibold text-center">{t('match.matchesPlayed', { defaultValue: 'Matches Played' })}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {aggregatedEntries.map((e) => (
                                                <tr key={e.id} className="hover:bg-bg/60 transition-colors">
                                                    <td className="py-3 px-5 font-semibold">{e.userName}</td>
                                                    <td className="py-3 px-5 text-center text-success font-bold tabular-nums">{e.totalPlus}</td>
                                                    <td className="py-3 px-5 text-center text-danger font-bold tabular-nums">{e.totalMinus}</td>
                                                    <td className="py-3 px-5 text-center text-text-muted tabular-nums">{e.matchesPlayed}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        )}

                        {/* Top Players */}
                        {(topScorer ?? topPenalized ?? topPpScorer ?? topShScorer) && (
                            <section className="mb-8 grid grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Top players">
                                {topScorer && (
                                    <div className="bg-surface border border-border rounded-lg p-5 flex flex-col justify-between shadow-card relative overflow-hidden group">
                                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                                            <Star size={96} weight="fill" />
                                        </div>
                                        <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-4 relative z-10">{t('season.topScorer')}</h3>
                                        <p className="text-base font-bold leading-tight mb-2 relative z-10">
                                            {topScorer.firstName} {topScorer.surname}
                                        </p>
                                        <div className="text-sm font-semibold text-primary relative z-10">
                                            {t('season.goals_count', { count: topScorer.count })}
                                        </div>
                                    </div>
                                )}
                                {topPpScorer && (
                                    <div className="bg-surface border border-border rounded-lg p-5 flex flex-col justify-between shadow-card relative overflow-hidden group">
                                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                                            <Lightning size={96} weight="fill" />
                                        </div>
                                        <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-4 relative z-10">{t('season.topPowerPlayScorer')}</h3>
                                        <p className="text-base font-bold leading-tight mb-2 relative z-10">
                                            {topPpScorer.firstName} {topPpScorer.surname}
                                        </p>
                                        <div className="text-sm font-semibold text-primary relative z-10">
                                            {t('season.goals_count', { count: topPpScorer.count })}
                                        </div>
                                    </div>
                                )}
                                {topShScorer && (
                                    <div className="bg-surface border border-border rounded-lg p-5 flex flex-col justify-between shadow-card relative overflow-hidden group">
                                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                                            <Shield size={96} weight="fill" />
                                        </div>
                                        <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-4 relative z-10">{t('season.topShortHandedScorer')}</h3>
                                        <p className="text-base font-bold leading-tight mb-2 relative z-10">
                                            {topShScorer.firstName} {topShScorer.surname}
                                        </p>
                                        <div className="text-sm font-semibold text-primary relative z-10">
                                            {t('season.goals_count', { count: topShScorer.count })}
                                        </div>
                                    </div>
                                )}
                                {topPenalized && (
                                    <div className="bg-surface border border-border rounded-lg p-5 flex flex-col justify-between shadow-card relative overflow-hidden group">
                                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none text-danger">
                                            <WarningOctagon size={96} weight="fill" />
                                        </div>
                                        <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-4 relative z-10">{t('season.mostPenalized')}</h3>
                                        <p className="text-base font-bold leading-tight mb-2 relative z-10">
                                            {topPenalized.firstName} {topPenalized.surname}
                                        </p>
                                        <div className="text-sm font-semibold text-danger relative z-10">
                                            {t('season.penalties_count', { count: topPenalized.count })}
                                        </div>
                                    </div>
                                )}
                            </section>
                        )}

                        {/* Main 2-col grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                            {/* Left: Matches by Week */}
                            <div className="lg:col-span-7 space-y-6">
                                {weekGroups.length > 0 && (
                                    <section aria-label="Weekly matches">
                                        <h2 className="text-sm font-bold uppercase tracking-wider border-b border-border pb-2 mb-4">
                                            {t('season.matchesByWeek')}
                                        </h2>
                                        {(() => {
                                            const matchNumberById = new Map(allMatches.map((m) => [m.id, m.matchNumber]))
                                            return weekGroups.map((group) => {
                                                const season = seasons.find((s) => s.id === seasonId)
                                                const hostedTeamId = season?.hostedTeamId ?? null

                                                return (
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
                                                                                onClick={() => void toggleExpand(m.matchId)}
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
                                                                                                    onClick={() => void reEvaluateBets(m.matchId)}
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
                                                )
                                            })
                                        })()}
                                    </section>
                                )}
                            </div>

                            {/* Right: Sticky Up Next */}
                            <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-6">
                                {(() => {
                                    const unplayed = allMatches
                                        .filter((m) => m.matchDate === null)
                                        .sort((a, b) => a.matchNumber - b.matchNumber)
                                    if (unplayed.length === 0) return null
                                    const upNext = unplayed[0]
                                    const upcoming = unplayed.slice(1)
                                    const season = seasons.find((s) => s.id === seasonId)
                                    const hostedTeamId = season?.hostedTeamId ?? null

                                    // Derive short names for unplayed matches from weekGroups (teams that appeared in past matches)
                                    const teamShortNameById = new Map<number, string>()
                                    for (const group of weekGroups) {
                                        for (const wm of group.matches) {
                                            if (wm.homeTeamShortName) teamShortNameById.set(wm.homeTeamId, wm.homeTeamShortName)
                                            if (wm.awayTeamShortName) teamShortNameById.set(wm.awayTeamId, wm.awayTeamShortName)
                                        }
                                    }

                                    const homeShort = teamShortNameById.get(upNext.homeTeamId) ?? null
                                    const awayShort = teamShortNameById.get(upNext.awayTeamId) ?? null
                                    const upNextHomeLogo = homeShort ? teamLogoUrl(homeShort) : null
                                    const upNextAwayLogo = awayShort ? teamLogoUrl(awayShort) : null

                                    return (
                                        <>
                                            <div className="flex items-center justify-between border-b border-border pb-2">
                                                <h2 className="text-sm font-bold uppercase tracking-wider">
                                                    {t('season.upNext')}
                                                </h2>
                                            </div>

                                            {/* Up Next card */}
                                            <div className="bg-surface border border-border rounded-lg p-5 shadow-card relative overflow-hidden">
                                                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

                                                {/* Match number + H2H toggle */}
                                                <div className="flex items-center justify-between mb-6 relative z-10">
                                                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider bg-bg px-2 py-1 rounded border border-border">
                                                        {t('season.match', { number: upNext.matchNumber })}
                                                    </span>
                                                    {hostedTeamId && !loadingH2H && h2hMatches.length > 0 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setH2hExpanded((prev) => !prev)}
                                                            className="text-[11px] text-primary hover:text-primary-hover font-bold transition-colors uppercase tracking-wider"
                                                        >
                                                            {h2hExpanded
                                                                ? t('season.hide')
                                                                : t('season.showMatches', { count: h2hMatches.length })}
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Teams */}
                                                <Link
                                                    to={`/seasons/${seasonId}/matches/${upNext.id}`}
                                                    className="flex items-center justify-between relative z-10 group/link"
                                                >
                                                    <div className="flex flex-col items-center gap-2 w-2/5">
                                                        {upNextHomeLogo ? (
                                                            <img
                                                                src={upNextHomeLogo}
                                                                alt={homeShort ?? ''}
                                                                className="w-14 h-14 object-contain"
                                                                onError={(e) => { ;(e.target as HTMLImageElement).style.display = 'none' }}
                                                            />
                                                        ) : (
                                                            <div className="w-14 h-14 rounded-full bg-bg border border-border flex items-center justify-center text-xs font-bold text-text-muted">
                                                                {upNext.homeTeamName?.slice(0, 3).toUpperCase()}
                                                            </div>
                                                        )}
                                                        <span className="text-sm font-bold text-center leading-tight">{upNext.homeTeamName}</span>
                                                    </div>
                                                    <div className="w-1/5 flex justify-center">
                                                        <span className="text-xs font-bold text-text-muted bg-bg px-2.5 py-1 rounded border border-border group-hover/link:border-primary/50 transition-colors">
                                                            {t('season.vs')}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col items-center gap-2 w-2/5">
                                                        {upNextAwayLogo ? (
                                                            <img
                                                                src={upNextAwayLogo}
                                                                alt={awayShort ?? ''}
                                                                className="w-14 h-14 object-contain"
                                                                onError={(e) => { ;(e.target as HTMLImageElement).style.display = 'none' }}
                                                            />
                                                        ) : (
                                                            <div className="w-14 h-14 rounded-full bg-bg border border-border flex items-center justify-center text-xs font-bold text-text-muted">
                                                                {upNext.awayTeamName?.slice(0, 3).toUpperCase()}
                                                            </div>
                                                        )}
                                                        <span className="text-sm font-bold text-center leading-tight text-text-muted">{upNext.awayTeamName}</span>
                                                    </div>
                                                </Link>

                                                {/* H2H section */}
                                                {hostedTeamId && (
                                                    <div className="mt-6 relative z-10">
                                                        {loadingH2H && (
                                                            <div className="flex items-center gap-2 text-text-muted text-sm py-2">
                                                                <svg className="animate-spin w-4 h-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                                </svg>
                                                                <span>{t('common.loading')}</span>
                                                            </div>
                                                        )}
                                                        {!loadingH2H && h2hMatches.length === 0 && (
                                                            <p className="text-sm text-text-muted py-2">{t('common.noData')}</p>
                                                        )}
                                                        {!loadingH2H && h2hMatches.length > 0 && h2hExpanded && (
                                                            <div className="border-t border-border pt-4">
                                                                <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">
                                                                    {t('season.previousMeetings')}
                                                                </h4>
                                                                <div className="space-y-1.5">
                                                                    {h2hMatches.map((h2hMatch) => {
                                                                        const ct = normalizeCompletionType(h2hMatch.completionType)
                                                                        const h2hHomeLogo = teamLogoUrl(h2hMatch.homeTeamShortName)
                                                                        const h2hAwayLogo = teamLogoUrl(h2hMatch.awayTeamShortName)
                                                                        return (
                                                                            <div key={h2hMatch.matchId} className="flex justify-between items-center bg-bg/50 border border-border rounded p-2 text-xs">
                                                                                <span className="text-text-muted font-medium whitespace-nowrap">
                                                                                    {new Date(h2hMatch.matchDate).toLocaleDateString()} · {h2hMatch.seasonName}
                                                                                </span>
                                                                                <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                                                                                    <img
                                                                                        src={h2hHomeLogo}
                                                                                        alt={h2hMatch.homeTeamShortName}
                                                                                        className="w-4 h-4 object-contain"
                                                                                        onError={(e) => { ;(e.target as HTMLImageElement).style.display = 'none' }}
                                                                                    />
                                                                                    <span className="font-bold tabular-nums">
                                                                                        {h2hMatch.homeScore}–{h2hMatch.awayScore}
                                                                                    </span>
                                                                                    <img
                                                                                        src={h2hAwayLogo}
                                                                                        alt={h2hMatch.awayTeamShortName}
                                                                                        className="w-4 h-4 object-contain"
                                                                                        onError={(e) => { ;(e.target as HTMLImageElement).style.display = 'none' }}
                                                                                    />
                                                                                    {ct !== CompletionType.None && <CompletionBadge type={ct} />}
                                                                                </div>
                                                                            </div>
                                                                        )
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Upcoming matches list */}
                                            {upcoming.length > 0 && (
                                                <div>
                                                    <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-3">
                                                        {t('season.upcomingMatches')}
                                                    </h3>
                                                    <div className="space-y-2">
                                                        {upcoming.map((m) => (
                                                            <Link
                                                                key={m.id}
                                                                to={`/seasons/${seasonId}/matches/${m.id}`}
                                                                className="group flex items-center gap-3 bg-surface border border-border rounded p-2.5 hover:border-primary/50 transition-colors"
                                                            >
                                                                <span className="text-[11px] font-bold text-text-muted w-6 shrink-0 tabular-nums">
                                                                    #{m.matchNumber}
                                                                </span>
                                                                <span className="text-sm font-medium text-text-muted group-hover:text-text transition-colors truncate">
                                                                    {m.homeTeamName} {t('season.vs')} {m.awayTeamName}
                                                                </span>
                                                            </Link>
                                                        ))}
                                                    </div>
                                                </div>
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
