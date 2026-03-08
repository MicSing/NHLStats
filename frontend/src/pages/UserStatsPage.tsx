import { useEffect, useState } from 'react'
import type { Season } from '../types/season'
import type { User } from '../types/user'
import type { PointReasonBreakdownItem, RosterPenalizedByUser, UserMatchSummary } from '../types/stats'
import apiClient from '../services/apiClient'
import { cacheService } from '../services/cacheService'
import { statsService } from '../services/statsService'
import SeasonSelector from '../components/SeasonSelector'
import PenaltyPointedChart from '../components/charts/PenaltyPointedChart'
import MinusPointsPieChart from '../components/charts/MinusPointsPieChart'
import UserWeekTrendChart from '../components/charts/UserWeekTrendChart'
import { useTranslation } from 'react-i18next'

// ESPN CDN uses different codes for some NHL teams (same mapping as SeasonPage)
const ESPN_NHL_CODES: Record<string, string> = {
    LAK: 'la',
    NJD: 'nj',
    SJS: 'sj',
    TBL: 'tb',
}
function teamLogoUrl(shortName: string): string {
    const code = ESPN_NHL_CODES[shortName.toUpperCase()] ?? shortName.toLowerCase()
    return `https://a.espncdn.com/i/teamlogos/nhl/500/${code}.png`
}

/** Compute sequential week numbers per season: seasonId → (dateStr → weekNumber) */
function computeWeekNumbersBySeasonId(matches: UserMatchSummary[]): Map<number, Map<string, number>> {
    const bySeasonId = new Map<number, UserMatchSummary[]>()
    for (const m of matches) {
        const group = bySeasonId.get(m.seasonId) ?? []
        group.push(m)
        bySeasonId.set(m.seasonId, group)
    }
    const result = new Map<number, Map<string, number>>()
    for (const [seasonId, seasonMatches] of bySeasonId) {
        const distinctDates = [...new Set(seasonMatches.map((m) => m.matchDate.slice(0, 10)))].sort()
        const dateToWeek = new Map<string, number>()
        distinctDates.forEach((date, idx) => dateToWeek.set(date, idx + 1))
        result.set(seasonId, dateToWeek)
    }
    return result
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

function groupMatchesByWeek(matches: UserMatchSummary[]): WeekSummary[] {
    const weeksBySeasonId = computeWeekNumbersBySeasonId(matches)
    const weekMap = new Map<string, UserMatchSummary[]>()
    for (const m of matches) {
        const wn = weeksBySeasonId.get(m.seasonId)?.get(m.matchDate.slice(0, 10)) ?? 1
        const key = `${m.seasonId}:${wn}`
        const group = weekMap.get(key) ?? []
        group.push(m)
        weekMap.set(key, group)
    }
    return Array.from(weekMap.entries())
        .map(([, ms]) => {
            const seasonId = ms[0].seasonId
            const wn = weeksBySeasonId.get(seasonId)?.get(ms[0].matchDate.slice(0, 10)) ?? 1
            return {
                seasonId,
                seasonName: ms[0].seasonName,
                weekNumber: wn,
                matchDates: [...new Set(ms.map((m) => m.matchDate.slice(0, 10)))].sort(),
                matchCount: ms.length,
                totalPlus: ms.reduce((s, m) => s + m.totalPlus, 0),
                totalMinus: ms.reduce((s, m) => s + m.totalMinus, 0),
                goalCount: ms.reduce((s, m) => s + m.goalCount, 0),
                penaltyCount: ms.reduce((s, m) => s + m.penaltyCount, 0),
                opponents: ms.map((m) => ({ name: m.opponentName, shortName: m.opponentShortName })),
            }
        })
        .sort((a, b) => {
            if (a.seasonId !== b.seasonId) return a.seasonId - b.seasonId
            return a.weekNumber - b.weekNumber
        })
}

function MatchCard({ title, match, seasonWeekLabel }: { title: string; match: UserMatchSummary | null; seasonWeekLabel?: string }) {
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
    const [matchHistory, setMatchHistory] = useState<UserMatchSummary[]>([])
    const [rosterPenalties, setRosterPenalties] = useState<{ playerName: string; count: number }[]>([])

    // Load seasons on mount
    useEffect(() => {
        apiClient
            .get<Season[]>('/api/seasons')
            .then((data) => {
                const sorted = [...data].sort(
                    (a, b) =>
                        new Date(b.startedOn).getTime() - new Date(a.startedOn).getTime(),
                )
                setSeasons(sorted)
                // Default to "All seasons" (null)
            })
            .finally(() => setLoadingSeasons(false))
    }, [])

    // When season selection changes, refresh the user list and auto-select first user
    useEffect(() => {
        setLoadingUsers(true)
        setSelectedUserId(null)
        setUsers([])
        setBreakdownItems([])
        setMatchHistory([])
        setRosterPenalties([])

        const promise: Promise<User[]> =
            selectedSeasonId != null
                ? cacheService.getUsers()
                : cacheService.getUsers()

        promise
            .then((fetched) => {
                const active = fetched.filter((u) => u.isActive !== false)
                setUsers(active)
                if (active.length > 0) setSelectedUserId(active[0].id)
            })
            .catch(() => setUsers([]))
            .finally(() => setLoadingUsers(false))
    }, [selectedSeasonId])

    // When user or season changes, fetch point-reason breakdown and match history
    useEffect(() => {
        if (selectedUserId == null) {
            setBreakdownItems([])
            setMatchHistory([])
            return
        }

        setLoadingData(true)

        const fetchRosterPenalties: Promise<{ playerName: string; count: number }[]> =
            selectedSeasonId != null
                ? apiClient
                    .get<RosterPenalizedByUser[]>(
                        `/api/seasons/${selectedSeasonId}/stats/roster-penalized-by-user`,
                    )
                    .then((data) =>
                        data
                            .flatMap((p) =>
                                p.userCounts
                                    .filter((uc) => uc.userId === selectedUserId)
                                    .map((uc) => ({
                                        playerName: `${p.firstName} ${p.surname}${p.teamShortName ? ` (${p.teamShortName})` : ''}`,
                                        count: uc.count,
                                    }))
                            )
                            .filter((p) => p.count > 0)
                            .sort((a, b) => b.count - a.count),
                    )
                    .catch(() => [])
                : Promise.resolve([])

        Promise.all([
            statsService.getUserPointReasonBreakdown(
                selectedUserId,
                selectedSeasonId ?? undefined,
            ),
            statsService.getUserMatchHistory(
                selectedUserId,
                selectedSeasonId ?? undefined,
            ),
            fetchRosterPenalties,
        ])
            .then(([breakdown, history, rosterPens]) => {
                setBreakdownItems(breakdown.items)
                setMatchHistory(history)
                setRosterPenalties(rosterPens)
            })
            .catch(() => {
                setBreakdownItems([])
                setMatchHistory([])
                setRosterPenalties([])
            })
            .finally(() => setLoadingData(false))
    }, [selectedUserId, selectedSeasonId])

    // Best match: max(plus − minus), then most goals, then fewest penalties
    function compareBest(a: UserMatchSummary, b: UserMatchSummary): number {
        const netA = a.totalPlus - a.totalMinus
        const netB = b.totalPlus - b.totalMinus
        if (netB !== netA) return netB - netA          // higher net wins
        if (b.goalCount !== a.goalCount) return b.goalCount - a.goalCount  // more goals wins
        return a.penaltyCount - b.penaltyCount          // fewer penalties wins
    }

    // Worst match: max(minus − plus), then most penalties, then fewest goals
    function compareWorst(a: UserMatchSummary, b: UserMatchSummary): number {
        const netA = a.totalMinus - a.totalPlus
        const netB = b.totalMinus - b.totalPlus
        if (netB !== netA) return netB - netA          // higher deficit wins
        if (b.penaltyCount !== a.penaltyCount) return b.penaltyCount - a.penaltyCount  // more penalties wins
        return a.goalCount - b.goalCount                // fewer goals wins
    }

    const bestMatch = matchHistory.length > 0
        ? [...matchHistory].sort(compareBest)[0]
        : null

    const worstMatch = matchHistory.length > 0
        ? [...matchHistory].sort(compareWorst)[0]
        : null

    // ── Season/Week lookup ──────────────────────────────────────────
    const weeksBySeasonId = computeWeekNumbersBySeasonId(matchHistory)
    function getSeasonWeekLabel(m: UserMatchSummary): string {
        const wn = weeksBySeasonId.get(m.seasonId)?.get(m.matchDate.slice(0, 10)) ?? 1
        return t('userStats.seasonWeekLabel', { season: m.seasonName, week: wn })
    }

    // ── Best / Worst Week ───────────────────────────────────────────
    const weeks = groupMatchesByWeek(matchHistory)

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

    const bestWeek = weeks.length > 0
        ? [...weeks].sort(compareWeekBest)[0]
        : null

    const worstWeek = weeks.length > 0
        ? [...weeks].sort(compareWeekWorst)[0]
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

            {/* ── Top row: Penalty/Pointed bar chart + Minus-points pie ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-surface rounded-xl p-4">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted mb-3">
                        {t('userStats.penalties')}
                    </h2>
                    <PenaltyPointedChart items={breakdownItems} rosterPenalties={rosterPenalties} />
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
                <UserWeekTrendChart matches={matchHistory} />
            </div>

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
