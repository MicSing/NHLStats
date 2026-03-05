import { useEffect, useState } from 'react'
import type { Season } from '../types/season'
import type { User } from '../types/user'
import type { PointReasonBreakdownItem, RosterPenalizedByUser, UserMatchSummary } from '../types/stats'
import apiClient from '../services/apiClient'
import { statsService } from '../services/statsService'
import SeasonSelector from '../components/SeasonSelector'
import PenaltyPointedChart from '../components/charts/PenaltyPointedChart'
import MinusPointsPieChart from '../components/charts/MinusPointsPieChart'
import UserWeekTrendChart from '../components/charts/UserWeekTrendChart'

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

function MatchCard({ title, match }: { title: string; match: UserMatchSummary | null }) {
    if (!match) {
        return (
            <div className="bg-surface rounded-xl p-6 flex flex-col gap-2">
                <h3 className="text-text-muted text-sm font-semibold uppercase tracking-wide">
                    {title}
                </h3>
                <p className="text-text-muted text-sm">No data yet</p>
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
    const side = match.isHome ? 'Home' : 'Away'

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
                        {score} · {side} · {date}
                    </p>
                </div>
            </div>
            <div className="flex gap-6 text-sm">
                <span className="text-success font-semibold">+{match.totalPlus}</span>
                <span className="text-danger font-semibold">−{match.totalMinus}</span>
                {match.goalCount > 0 && (
                    <span className="text-text-muted">⛳ {match.goalCount} goal{match.goalCount !== 1 ? 's' : ''}</span>
                )}
            </div>
        </div>
    )
}

export default function UserStatsPage() {
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
                ? statsService.getSeasonUsers(selectedSeasonId)
                : apiClient.get<User[]>('/api/users')

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

    return (
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
            <h1 className="text-2xl font-bold text-text">📈 Player Stats</h1>

            {/* ── Selectors row ──────────────────────────────────────────── */}
            <div className="flex items-center gap-4 flex-wrap">
                {loadingSeasons ? (
                    <div className="text-text-muted text-sm">Loading seasons…</div>
                ) : (
                    <SeasonSelector
                        seasons={seasons}
                        selectedId={selectedSeasonId}
                        onChange={setSelectedSeasonId}
                    />
                )}

                {loadingUsers ? (
                    <div className="text-text-muted text-sm">Loading players…</div>
                ) : (
                    <select
                        aria-label="Select player"
                        value={selectedUserId ?? ''}
                        onChange={(e) =>
                            setSelectedUserId(
                                e.target.value ? Number(e.target.value) : null,
                            )
                        }
                        className="bg-surface text-text rounded-lg px-3 py-1.5 text-sm border border-border focus:outline-none focus:border-primary transition-colors"
                    >
                        {users.length === 0 && (
                            <option value="">No players</option>
                        )}
                        {users.map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.name}
                            </option>
                        ))}
                    </select>
                )}

                {loadingData && (
                    <span className="text-text-muted text-sm">Loading stats…</span>
                )}
            </div>

            {/* ── Top row: Penalty/Pointed bar chart + Minus-points pie ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-surface rounded-xl p-4">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted mb-3">
                        Penalties
                    </h2>
                    <PenaltyPointedChart items={breakdownItems} rosterPenalties={rosterPenalties} />
                </div>
                <div className="bg-surface rounded-xl p-4">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted mb-3">
                        Minus Points Breakdown
                    </h2>
                    <MinusPointsPieChart items={breakdownItems} />
                </div>
            </div>

            {/* ── Middle row: week trend chart (full width) ─────────────── */}
            <div className="bg-surface rounded-xl p-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted mb-3">
                    Week Trend
                </h2>
                <UserWeekTrendChart matches={matchHistory} />
            </div>

            {/* ── Bottom row: best / worst match highlight cards ─────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <MatchCard title="🏆 Best Match" match={bestMatch} />
                <MatchCard title="💀 Worst Match" match={worstMatch} />
            </div>
        </div>
    )
}
