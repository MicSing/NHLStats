import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Season } from '../types/season'
import type { WeekGroup, UserSeasonStats, TopRosterPlayer, UserSeasonTotals } from '../types/stats'
import type { UserMatch } from '../types/userMatch'
import { CompletionType } from '../types/match'
import type { Match } from '../types/match'
import apiClient from '../services/apiClient'
import SeasonSelector from '../components/SeasonSelector'

function CompletionBadge({ type }: { type: CompletionType }) {
    const map: Record<CompletionType, { label: string; className: string }> = {
        [CompletionType.None]: { label: 'Not Played', className: 'bg-border text-text-muted' },
        [CompletionType.RegularTime]: { label: 'REG', className: 'bg-success/20 text-success' },
        [CompletionType.Overtime]: { label: 'OT', className: 'bg-warning/20 text-warning' },
        [CompletionType.Shootout]: { label: 'SO', className: 'bg-secondary/20 text-secondary' },
    }
    const { label, className } = map[type] ?? map[CompletionType.None]
    return (
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${className}`}>{label}</span>
    )
}

export default function SeasonPage() {
    const { seasonId: seasonIdParam } = useParams<{ seasonId?: string }>()
    const navigate = useNavigate()
    const seasonId = seasonIdParam ? Number(seasonIdParam) : null

    const [seasons, setSeasons] = useState<Season[]>([])
    const [weekGroups, setWeekGroups] = useState<WeekGroup[]>([])
    const [stats, setStats] = useState<UserSeasonStats[]>([])
    const [userTotals, setUserTotals] = useState<UserSeasonTotals[]>([])
    const [topScorer, setTopScorer] = useState<TopRosterPlayer | null>(null)
    const [topPenalized, setTopPenalized] = useState<TopRosterPlayer | null>(null)
    const [aggregatedEntries, setAggregatedEntries] = useState<UserMatch[]>([])
    const [allMatches, setAllMatches] = useState<Match[]>([])
    const [loadingSeasons, setLoadingSeasons] = useState(true)
    const [loadingData, setLoadingData] = useState(false)

    useEffect(() => {
        apiClient
            .get<Season[]>('/api/seasons')
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
        if (!seasonId) return

        setLoadingData(true)

        Promise.all([
            apiClient.get<WeekGroup[]>(`/api/seasons/${seasonId}/stats/weekly`),
            apiClient.get<UserSeasonStats[]>(`/api/seasons/${seasonId}/stats`),
            apiClient
                .get<TopRosterPlayer | null>(`/api/seasons/${seasonId}/stats/top-scorers`)
                .catch(() => null),
            apiClient
                .get<TopRosterPlayer | null>(`/api/seasons/${seasonId}/stats/top-penalized`)
                .catch(() => null),
            apiClient.get<UserMatch[]>(`/api/seasons/${seasonId}/usermatches`),
            apiClient.get<Match[]>(`/api/seasons/${seasonId}/matches`),
            apiClient.get<UserSeasonTotals[]>(`/api/seasons/${seasonId}/stats/user-totals`).catch(() => []),
        ])
            .then(([weeks, seasonStats, scorer, penalized, aggregated, matches, totals]) => {
                setWeekGroups(weeks)
                setStats(seasonStats)
                setTopScorer(scorer)
                setTopPenalized(penalized)
                setAggregatedEntries(aggregated)
                setAllMatches(matches)
                setUserTotals(totals)
            })
            .finally(() => setLoadingData(false))
    }, [seasonId])

    const handleSeasonChange = (id: number | null) => {
        if (id === null) navigate('/seasons')
        else navigate(`/seasons/${id}`)
    }

    return (
        <div className="min-h-screen bg-bg text-text p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <h1 className="text-2xl font-bold text-primary">Season Overview</h1>
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
                        📊 Dashboard
                    </Link>
                </div>

                {!seasonId && (
                    <p className="text-text-muted">Select a season to view details.</p>
                )}

                {seasonId && loadingData && <p>Loading…</p>}

                {seasonId && !loadingData && (
                    <>
                        {/* User Stats Table */}
                        {stats.length > 0 && (
                            <section className="mb-8" aria-label="User stats">
                                <h2 className="text-lg font-semibold mb-3 text-primary/80">
                                    Player Stats
                                </h2>
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-text-muted border-b border-border">
                                            <th className="pb-2">Player</th>
                                            <th className="pb-2">+</th>
                                            <th className="pb-2">−</th>
                                            <th className="pb-2">Goals</th>
                                            <th className="pb-2">Penalties</th>
                                            <th className="pb-2">Earnings</th>
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
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </section>
                        )}

                        {/* Top Players */}
                        {(topScorer ?? topPenalized) && (
                            <section className="mb-8 flex gap-6" aria-label="Top players">
                                {topScorer && (
                                    <div className="card p-4">
                                        <h3 className="text-sm text-text-muted mb-1">Top Scorer</h3>
                                        <p className="font-semibold">
                                            {topScorer.firstName} {topScorer.surname}
                                        </p>
                                        <p className="text-sm text-text-muted">
                                            {topScorer.teamShortName} · {topScorer.count} goals
                                        </p>
                                    </div>
                                )}
                                {topPenalized && (
                                    <div className="card p-4">
                                        <h3 className="text-sm text-text-muted mb-1">
                                            Most Penalized
                                        </h3>
                                        <p className="font-semibold">
                                            {topPenalized.firstName} {topPenalized.surname}
                                        </p>
                                        <p className="text-sm text-text-muted">
                                            {topPenalized.teamShortName} · {topPenalized.count}{' '}
                                            penalties
                                        </p>
                                    </div>
                                )}
                            </section>
                        )}

                        {/* Weekly Matches */}
                        {weekGroups.length > 0 && (
                            <section aria-label="Weekly matches">
                                <h2 className="text-lg font-semibold mb-4 text-primary">
                                    Matches by Week
                                </h2>
                                {weekGroups.map((group) => (
                                    <div key={group.weekNumber} className="mb-6">
                                        <h3 className="text-sm text-text-muted mb-2 border-b border-border pb-1">
                                            Week {group.weekNumber}
                                        </h3>
                                        <div className="space-y-2">
                                            {group.matches.map((m) => (
                                                <Link
                                                    key={m.matchId}
                                                    to={`/seasons/${seasonId}/matches/${m.matchId}`}
                                                    className="flex items-center justify-between card rounded-lg px-4 py-3 hover:bg-surface/80 transition-colors"
                                                >
                                                    <span>
                                                        {m.homeTeamName} vs {m.awayTeamName}
                                                    </span>
                                                    <span className="font-mono text-lg">
                                                        {m.homeScore} – {m.awayScore}
                                                    </span>
                                                    <span className="text-sm text-text-muted">
                                                        {new Date(m.matchDate).toLocaleDateString()}
                                                    </span>
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </section>
                        )}

                        {/* Up Next + Upcoming unplayed matches */}
                        {(() => {
                            const unplayed = allMatches
                                .filter((m) => m.matchDate === null)
                                .sort((a, b) => a.matchNumber - b.matchNumber)
                            if (unplayed.length === 0) return null
                            const upNext = unplayed[0]
                            const upcoming = unplayed.slice(1)
                            return (
                                <>
                                    <section className="mt-8" aria-label="Up next match">
                                        <h2 className="text-lg font-semibold mb-3 text-primary">
                                            Up Next
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
                                                        Match #{upNext.matchNumber}
                                                    </p>
                                                    <p className="text-2xl font-mono text-text-muted">
                                                        vs
                                                    </p>
                                                    <CompletionBadge
                                                        type={upNext.completionType}
                                                    />
                                                </div>
                                                <div className="text-center flex-1">
                                                    <p className="text-lg font-bold">
                                                        {upNext.awayTeamName}
                                                    </p>
                                                </div>
                                            </div>
                                        </Link>
                                    </section>

                                    {upcoming.length > 0 && (
                                        <section className="mt-6" aria-label="Upcoming matches">
                                            <h2 className="text-lg font-semibold mb-3 text-primary">
                                                Upcoming
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
                                                            {m.homeTeamName} vs {m.awayTeamName}
                                                        </span>
                                                        <CompletionBadge
                                                            type={m.completionType}
                                                        />
                                                    </Link>
                                                ))}
                                            </div>
                                        </section>
                                    )}
                                </>
                            )
                        })()}

                        {/* Aggregated Entries */}
                        {aggregatedEntries.length > 0 && (
                            <section className="mt-8" aria-label="Aggregated entries">
                                <h2 className="text-lg font-semibold mb-3 text-primary">
                                    Aggregated Entries
                                </h2>
                                <div className="space-y-2">
                                    {aggregatedEntries.map((um) => (
                                        <div
                                            key={um.id}
                                            className="card rounded-lg px-4 py-3 flex items-center justify-between"
                                        >
                                            <span>{um.userName}</span>
                                            <span className="text-sm text-text-muted">
                                                +{um.totalPlus} / −{um.totalMinus}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
