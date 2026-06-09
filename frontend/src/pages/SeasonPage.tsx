import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BellRinging } from '@phosphor-icons/react'
import type { Season } from '../types/season'
import type { WeekGroup, UserSeasonStats, TopRosterPlayer, UserSeasonTotals, HeadToHeadMatch, SeasonTotals } from '../types/stats'
import { CompletionType } from '../types/match'
import type { Match } from '../types/match'
import type { UserMatch, UserMatchPoint, UserMatchGoal, UserMatchPenalty } from '../types/userMatch'
import type { BetDto } from '../types/bet'
import apiClient from '../services/apiClient'
import { cacheService } from '../services/cacheService'
import { statsService } from '../services/statsService'
import { bettingService } from '../services/bettingService'
import SeasonSelector from '../components/SeasonSelector'
import LoadingSpinner from '../components/LoadingSpinner'
import PageLayout from '../components/PageLayout'
import { useTranslation } from 'react-i18next'
import { useIsAdmin } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useSeasonEventNotifications } from '../hooks/useSeasonEventNotifications'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { normalizeCompletionType } from '../components/season/seasonUtils'
import type { MatchExpandDetail } from '../components/season/ExpandedMatchSection'
import type { AggEntry } from '../components/season/AggregatedEntriesTable'
import SeasonStatsTable from '../components/season/SeasonStatsTable'
import HostedTeamRecord from '../components/season/HostedTeamRecord'
import AggregatedEntriesTable from '../components/season/AggregatedEntriesTable'
import TopPlayersGrid from '../components/season/TopPlayersGrid'
import WeeklyMatches from '../components/season/WeeklyMatches'
import UpNextPanel from '../components/season/UpNextPanel'

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
    const [aggregatedEntries, setAggregatedEntries] = useState<AggEntry[]>([])
    const [allBets, setAllBets] = useState<BetDto[]>([])
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
        bettingService.listAll().then(setAllBets).catch(() => {})
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

                const aggEntries: AggEntry[] = aggData.map(e => ({
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
        let W = 0, L = 0, OTW = 0, OT = 0
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
            if (hs > os) {
                if (!isOTGame) W++; else OTW++
                if (isHome) winsHome++; else winsAway++
            } else if (hs < os) {
                L++
                if (isHome) lossesHome++; else lossesAway++
            }
        }
        return { W, L, OTW, OT, winsHome, winsAway, lossesHome, lossesAway }
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
                        <SeasonStatsTable stats={stats} userTotals={userTotals} />
                        <HostedTeamRecord
                            currentSeason={currentSeason}
                            hostedTeamShortName={hostedTeamShortName ?? null}
                            hostedStats={hostedStats}
                        />
                        <AggregatedEntriesTable entries={aggregatedEntries} />
                        <TopPlayersGrid
                            topScorer={topScorer}
                            topPenalized={topPenalized}
                            topPpScorer={topPpScorer}
                            topShScorer={topShScorer}
                        />

                        {/* Main 2-col grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                            <div className="lg:col-span-7 space-y-6">
                                <WeeklyMatches
                                    weekGroups={weekGroups}
                                    allMatches={allMatches}
                                    seasonId={seasonId}
                                    seasons={seasons}
                                    expandedMatchId={expandedMatchId}
                                    matchDetailCache={matchDetailCache}
                                    reEvaluatingMatchId={reEvaluatingMatchId}
                                    isAdmin={isAdmin}
                                    allBets={allBets}
                                    onToggleExpand={(matchId) => { void toggleExpand(matchId) }}
                                    onReEvaluateBets={(matchId) => { void reEvaluateBets(matchId) }}
                                />
                            </div>
                            <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-6">
                                <UpNextPanel
                                    allMatches={allMatches}
                                    weekGroups={weekGroups}
                                    seasonId={seasonId}
                                    seasons={seasons}
                                    loadingH2H={loadingH2H}
                                    h2hMatches={h2hMatches}
                                    h2hExpanded={h2hExpanded}
                                    onToggleH2H={() => setH2hExpanded((prev) => !prev)}
                                />
                            </div>
                        </div>
                    </>
                )}
            </div>
        </PageLayout>
    )
}
