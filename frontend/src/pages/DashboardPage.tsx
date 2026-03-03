import { useEffect, useState } from 'react'
import type { Season } from '../types/season'
import type { UserSeasonStats, AllTimeEarnings, RosterScorerByUser, RosterPenalizedByUser, PeriodPlusMinus } from '../types/stats'
import apiClient from '../services/apiClient'
import SeasonSelector from '../components/SeasonSelector'
import PlusMinusChart from '../components/charts/PlusMinusChart'
import TrendChart from '../components/charts/TrendChart'
import TopScorersChart from '../components/charts/TopScorersChart'
import PenaltyLeadersChart from '../components/charts/PenaltyLeadersChart'
import EarningsChart from '../components/charts/EarningsChart'

export default function DashboardPage() {
    const [seasons, setSeasons] = useState<Season[]>([])
    const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null)
    const [seasonStats, setSeasonStats] = useState<UserSeasonStats[]>([])
    const [rosterScorers, setRosterScorers] = useState<RosterScorerByUser[]>([])
    const [rosterPenalized, setRosterPenalized] = useState<RosterPenalizedByUser[]>([])
    const [allTimeEarnings, setAllTimeEarnings] = useState<AllTimeEarnings | null>(null)
    const [trendData, setTrendData] = useState<PeriodPlusMinus[]>([])
    const [loadingSeasons, setLoadingSeasons] = useState(true)
    const [loadingStats, setLoadingStats] = useState(false)
    const [loadingTrend, setLoadingTrend] = useState(false)

    // Load seasons and all-time earnings on mount
    useEffect(() => {
        apiClient
            .get<Season[]>('/api/seasons')
            .then((data) => {
                const sorted = [...data].sort(
                    (a, b) => new Date(b.startedOn).getTime() - new Date(a.startedOn).getTime(),
                )
                setSeasons(sorted)
                if (sorted.length > 0) setSelectedSeasonId(sorted[0].id)
            })
            .finally(() => setLoadingSeasons(false))

        apiClient
            .get<AllTimeEarnings>('/api/stats/earnings')
            .then(setAllTimeEarnings)
            .catch(() => setAllTimeEarnings(null))
    }, [])

    // Load per-season stats when a season is selected, or all-seasons aggregated stats
    useEffect(() => {
        if (!selectedSeasonId) {
            // "All seasons" — fetch aggregated plus/minus stats and season-level trend
            setLoadingStats(true)
            setLoadingTrend(true)
            apiClient
                .get<UserSeasonStats[]>('/api/stats/plus-minus')
                .then((stats) => {
                    setSeasonStats(stats)
                    setRosterScorers([])
                    setRosterPenalized([])
                })
                .catch(() => {
                    setSeasonStats([])
                    setRosterScorers([])
                    setRosterPenalized([])
                })
                .finally(() => setLoadingStats(false))

            apiClient
                .get<PeriodPlusMinus[]>('/api/stats/plus-minus-trend')
                .then(setTrendData)
                .catch(() => setTrendData([]))
                .finally(() => setLoadingTrend(false))
            return
        }
        setLoadingStats(true)
        setLoadingTrend(true)
        Promise.all([
            apiClient.get<UserSeasonStats[]>(`/api/seasons/${selectedSeasonId}/stats`),
            apiClient
                .get<RosterScorerByUser[]>(`/api/seasons/${selectedSeasonId}/stats/roster-scorers-by-user`)
                .catch(() => [] as RosterScorerByUser[]),
            apiClient
                .get<RosterPenalizedByUser[]>(`/api/seasons/${selectedSeasonId}/stats/roster-penalized-by-user`)
                .catch(() => [] as RosterPenalizedByUser[]),
        ])
            .then(([stats, scorers, penalized]) => {
                setSeasonStats(stats)
                setRosterScorers(scorers)
                setRosterPenalized(penalized)
            })
            .catch(() => {
                setSeasonStats([])
                setRosterScorers([])
                setRosterPenalized([])
            })
            .finally(() => setLoadingStats(false))

        // Weekly trend for the selected season (with automatic backfill from previous season)
        apiClient
            .get<PeriodPlusMinus[]>(`/api/seasons/${selectedSeasonId}/stats/plus-minus-trend-weekly`)
            .then(setTrendData)
            .catch(() => setTrendData([]))
            .finally(() => setLoadingTrend(false))
    }, [selectedSeasonId])

    return (
        <div className="min-h-screen bg-bg text-text p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <h1 className="text-2xl font-bold text-primary">Dashboard</h1>
                    {!loadingSeasons && (
                        <SeasonSelector
                            seasons={seasons}
                            selectedId={selectedSeasonId}
                            onChange={setSelectedSeasonId}
                        />
                    )}
                </div>

                {/* Season-specific charts (2-column grid) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    {/* Plus / Minus */}
                    <section className="card p-5">
                        <h2 className="text-sm font-semibold text-primary mb-3">Plus / Minus by Player</h2>
                        {loadingStats ? (
                            <p className="text-text-muted text-sm text-center py-8">Loading…</p>
                        ) : (
                            <PlusMinusChart data={seasonStats} />
                        )}
                    </section>

                    {/* Top Scorers */}
                    <section className="card p-5">
                        <h2 className="text-sm font-semibold text-primary mb-3">Top Scorers (In-Game Players)</h2>
                        {loadingStats ? (
                            <p className="text-text-muted text-sm text-center py-8">Loading…</p>
                        ) : (
                            <TopScorersChart data={rosterScorers} />
                        )}
                    </section>

                    {/* Penalty Leaders */}
                    <section className="card p-5">
                        <h2 className="text-sm font-semibold text-primary mb-3">Penalty Leaders (In-Game Players)</h2>
                        {loadingStats ? (
                            <p className="text-text-muted text-sm text-center py-8">Loading…</p>
                        ) : (
                            <PenaltyLeadersChart data={rosterPenalized} />
                        )}
                    </section>

                    {/* All-Time Earnings */}
                    <section className="card p-5" data-testid="earnings-section">
                        <h2 className="text-sm font-semibold text-primary mb-3">All-Time Earnings</h2>
                        {allTimeEarnings ? (
                            <>
                                <EarningsChart data={allTimeEarnings.userEarnings} />
                                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-center">
                                    <div className="bg-bg rounded-lg p-2 border border-border">
                                        <p className="text-text-muted">Collected</p>
                                        <p className="text-success font-semibold">
                                            {allTimeEarnings.totalCollected.toFixed(2)} €
                                        </p>
                                    </div>
                                    <div className="bg-bg rounded-lg p-2 border border-border">
                                        <p className="text-text-muted">Expenses</p>
                                        <p className="text-danger font-semibold">
                                            {allTimeEarnings.totalExpenses.toFixed(2)} €
                                        </p>
                                    </div>
                                    <div className="bg-bg rounded-lg p-2 border border-border">
                                        <p className="text-text-muted">Balance</p>
                                        <p className={`font-semibold ${allTimeEarnings.balance >= 0 ? 'text-success' : 'text-danger'}`}>
                                            {allTimeEarnings.balance.toFixed(2)} €
                                        </p>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <EarningsChart data={[]} />
                        )}
                    </section>
                </div>

                {/* Plus / Minus Trend (split into two charts) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    <section className="card p-5">
                        <h2 className="text-sm font-semibold text-primary mb-3">
                            Plus Trend {selectedSeasonId ? '(by Week)' : '(by Season)'}
                        </h2>
                        {loadingTrend ? (
                            <p className="text-text-muted text-sm text-center py-8">Loading…</p>
                        ) : (
                            <TrendChart data={trendData} mode="plus" />
                        )}
                    </section>
                    <section className="card p-5">
                        <h2 className="text-sm font-semibold text-primary mb-3">
                            Minus Trend {selectedSeasonId ? '(by Week)' : '(by Season)'}
                        </h2>
                        {loadingTrend ? (
                            <p className="text-text-muted text-sm text-center py-8">Loading…</p>
                        ) : (
                            <TrendChart data={trendData} mode="minus" />
                        )}
                    </section>
                </div>
            </div>
        </div>
    )
}
