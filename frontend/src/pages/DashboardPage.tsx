import { useEffect, useState } from 'react'
import type { Season } from '../types/season'
import type { UserSeasonStats, AllTimeEarnings, SeasonEarningsEntry, RosterScorerByUser, RosterPenalizedByUser, PeriodPlusMinus } from '../types/stats'
import apiClient from '../services/apiClient'
import SeasonSelector from '../components/SeasonSelector'
import PlusMinusChart from '../components/charts/PlusMinusChart'
import TrendChart from '../components/charts/TrendChart'
import TopScorersChart from '../components/charts/TopScorersChart'
import PenaltyLeadersChart from '../components/charts/PenaltyLeadersChart'
import EarningsChart from '../components/charts/EarningsChart'
import LoadingSpinner from '../components/LoadingSpinner'
import { useTranslation } from 'react-i18next'

export default function DashboardPage() {
    const { t } = useTranslation()
    const [seasons, setSeasons] = useState<Season[]>([])
    const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null)
    const [seasonStats, setSeasonStats] = useState<UserSeasonStats[]>([])
    const [rosterScorers, setRosterScorers] = useState<RosterScorerByUser[]>([])
    const [rosterPenalized, setRosterPenalized] = useState<RosterPenalizedByUser[]>([])
    const [allTimeEarnings, setAllTimeEarnings] = useState<AllTimeEarnings | null>(null)
    const [earningsBySeason, setEarningsBySeason] = useState<SeasonEarningsEntry[]>([])
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

        apiClient
            .get<SeasonEarningsEntry[]>('/api/stats/earnings-by-season')
            .then(setEarningsBySeason)
            .catch(() => setEarningsBySeason([]))
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
                    <h1 className="text-2xl font-bold text-primary">{t('dashboard.title')}</h1>
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
                        <h2 className="text-sm font-semibold text-primary mb-3">{t('dashboard.plusMinusByPlayer')}</h2>
                        {loadingStats ? (
                            <LoadingSpinner size="sm" inline />
                        ) : (
                            <PlusMinusChart data={seasonStats} />
                        )}
                    </section>

                    {/* Earnings */}
                    <section className="card p-5" data-testid="earnings-section">
                        <h2 className="text-sm font-semibold text-primary mb-3">
                            {selectedSeasonId ? t('dashboard.seasonEarnings') : t('dashboard.allTimeEarnings')}
                        </h2>
                        <EarningsChart data={earningsBySeason} selectedSeasonId={selectedSeasonId} />
                        {!selectedSeasonId && allTimeEarnings && (
                            <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-center">
                                <div className="bg-bg rounded-lg p-2 border border-border">
                                    <p className="text-text-muted">{t('dashboard.collected')}</p>
                                    <p className="text-success font-semibold">
                                        {allTimeEarnings.totalCollected.toFixed(2)} €
                                    </p>
                                </div>
                                <div className="bg-bg rounded-lg p-2 border border-border">
                                    <p className="text-text-muted">{t('dashboard.expenses')}</p>
                                    <p className="text-danger font-semibold">
                                        {allTimeEarnings.totalExpenses.toFixed(2)} €
                                    </p>
                                </div>
                                <div className="bg-bg rounded-lg p-2 border border-border">
                                    <p className="text-text-muted">{t('dashboard.canBeCollected')}</p>
                                    <p className={`font-semibold ${allTimeEarnings.canBeCollected > 100 ? 'text-danger' :
                                        allTimeEarnings.canBeCollected > 20 ? 'text-warning' : 'text-success'}`}>
                                        {allTimeEarnings.canBeCollected.toFixed(2)} €
                                    </p>
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Top Scorers */}
                    {(loadingStats || rosterScorers.length > 0) && (
                        <section className="card p-5">
                            <h2 className="text-sm font-semibold text-primary mb-3">{t('dashboard.topScorers')}</h2>
                            {loadingStats ? (
                                <LoadingSpinner size="sm" inline />
                            ) : (
                                <TopScorersChart data={rosterScorers} />
                            )}
                        </section>
                    )}

                    {/* Penalty Leaders */}
                    {(loadingStats || rosterPenalized.length > 0) && (
                        <section className="card p-5">
                            <h2 className="text-sm font-semibold text-primary mb-3">{t('dashboard.penaltyLeaders')}</h2>
                            {loadingStats ? (
                                <LoadingSpinner size="sm" inline />
                            ) : (
                                <PenaltyLeadersChart data={rosterPenalized} />
                            )}
                        </section>
                    )}
                </div>

                {/* Plus / Minus Trend (split into two charts) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    <section className="card p-5">
                        <h2 className="text-sm font-semibold text-primary mb-3">
                            {t('dashboard.plusTrend')} {selectedSeasonId ? t('dashboard.byWeek') : t('dashboard.bySeason')}
                        </h2>
                        {loadingTrend ? (
                            <LoadingSpinner size="sm" inline />
                        ) : (
                            <TrendChart data={trendData} mode="plus" />
                        )}
                    </section>
                    <section className="card p-5">
                        <h2 className="text-sm font-semibold text-primary mb-3">
                            {t('dashboard.minusTrend')} {selectedSeasonId ? t('dashboard.byWeek') : t('dashboard.bySeason')}
                        </h2>
                        {loadingTrend ? (
                            <LoadingSpinner size="sm" inline />
                        ) : (
                            <TrendChart data={trendData} mode="minus" />
                        )}
                    </section>
                </div>
            </div>
        </div>
    )
}
