import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Season } from '../types/season'
import type { User } from '../types/user'
import type { DashboardData, MatchHistoryItem, PointReasonBreakdownItem, RosterPenalizedByUser, RosterScorerByUser, SeasonMatchHistory } from '../types/stats'
import type { UserAchievements } from '../types/achievement'
import { cacheService } from '../services/cacheService'
import { bettingService } from '../services/bettingService'
import type { BetDto } from '../types/bet'
import PenaltyPointedChart from '../components/charts/PenaltyPointedChart'
import MinusPointsPieChart from '../components/charts/MinusPointsPieChart'
import UserWeekTrendChart from '../components/charts/UserWeekTrendChart'
import TopScorersChart from '../components/charts/TopScorersChart'
import PenaltyLeadersChart from '../components/charts/PenaltyLeadersChart'
import { useTranslation } from 'react-i18next'
import type { MatchWithContext, WeekSummary } from '../components/stats/statsTypes'
import { flattenMatches, flattenWeeks } from '../components/stats/statsUtils'
import MatchCard from '../components/stats/MatchCard'
import WeekCard from '../components/stats/WeekCard'
import BetCard from '../components/stats/BetCard'
import AchievementsTab from '../components/stats/AchievementsTab'

type Tab = 'stats' | 'achievements'

export default function UserStatsPage() {
    const { t } = useTranslation()
    const [searchParams, setSearchParams] = useSearchParams()
    const rawTab = searchParams.get('tab')
    const tab: Tab = rawTab === 'achievements' ? 'achievements' : 'stats'
    const setTab = (next: Tab) => setSearchParams((p) => { p.set('tab', next); return p }, { replace: true })
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
    const [userAchievements, setUserAchievements] = useState<UserAchievements | null>(null)
    const [loadingAchievements, setLoadingAchievements] = useState(false)

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
            setUserAchievements(null)
            return
        }
        setLoadingAchievements(true)
        cacheService.getAchievements(selectedUserId)
            .then(setUserAchievements)
            .catch(() => setUserAchievements(null))
            .finally(() => setLoadingAchievements(false))
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

    const playedWeeks = allWeeks.filter((w) => w.matchCount > 0)
    const bestWeek = playedWeeks.length > 0 ? [...playedWeeks].sort(compareWeekBest)[0] : null
    const worstWeek = playedWeeks.length > 0 ? [...playedWeeks].sort(compareWeekWorst)[0] : null

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
                    <div className="flex items-center gap-3">
                        <h1 className="text-lg font-semibold tracking-tight text-text">{t('userStats.title')}</h1>
                        <div className="flex rounded-lg overflow-hidden border border-border text-sm">
                            <button
                                onClick={() => setTab('stats')}
                                className={['px-3 py-1.5 transition-colors', tab === 'stats' ? 'bg-primary text-white' : 'text-text-muted hover:text-text'].join(' ')}
                            >
                                {t('userStats.tabStats')}
                            </button>
                            <button
                                onClick={() => setTab('achievements')}
                                className={['px-3 py-1.5 transition-colors', tab === 'achievements' ? 'bg-primary text-white' : 'text-text-muted hover:text-text'].join(' ')}
                            >
                                {t('userStats.tabAchievements')}
                            </button>
                        </div>
                    </div>
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

                {tab === 'achievements' && (
                    <AchievementsTab
                        achievements={userAchievements?.achievements ?? []}
                        loading={loadingAchievements}
                    />
                )}

                {tab === 'stats' && <>

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

                </>}

            </main>
        </div>
    )
}
