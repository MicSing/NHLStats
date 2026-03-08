import { useEffect, useState } from 'react'
import type { Season } from '../types/season'
import type { DashboardData, RosterPenalizedByUser, RosterScorerByUser, UserSeasonStats } from '../types/stats'
import type { User } from '../types/user'
import apiClient from '../services/apiClient'
import { cacheService } from '../services/cacheService'
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
    const [users, setUsers] = useState<User[]>([])
    const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null)
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
    const [loadingDashboard, setLoadingDashboard] = useState(true)

    const handleSeasonChange = (seasonId: number | null) => {
        setSelectedSeasonId(seasonId)
    }

    // Load dashboard and supporting lookup data once.
    useEffect(() => {
        Promise.all([
            apiClient.get<DashboardData>('/api/stats/dashboard'),
            cacheService.getSeasons(),
            cacheService.getUsers(),
        ])
            .then(([dashboard, fetchedSeasons, fetchedUsers]) => {
                setDashboardData(dashboard)
                setUsers(fetchedUsers)

                const sortedSeasons = [...fetchedSeasons].sort(
                    (a, b) => new Date(b.startedOn).getTime() - new Date(a.startedOn).getTime(),
                )
                setSeasons(sortedSeasons)

                if (sortedSeasons.length > 0) {
                    setSelectedSeasonId(sortedSeasons[0].id)
                }
            })
            .catch(() => {
                setDashboardData(null)
                setUsers([])
                setSeasons([])
            })
            .finally(() => setLoadingDashboard(false))
    }, [])

    const safeDashboardData: DashboardData = dashboardData ?? {
        seasonStats: [],
        earningsBySeason: [],
        trendData: [],
        rosterScorers: [],
        rosterPenalized: [],
        allTimeStats: [],
        allTimeEarnings: {
            userEarnings: [],
            totalCollected: 0,
            canBeCollected: 0,
            totalExpenses: 0,
        },
        allTimePlusMinusTrend: [],
        allTimeRosterScorers: [],
        allTimeRosterPenalized: [],
    }

    const userNameById = new Map(users.map((u) => [u.id, u.name]))

    const selectedSeasonStats = selectedSeasonId
        ? safeDashboardData.seasonStats.find((s) => s.seasonId === selectedSeasonId)?.userStats ?? []
        : safeDashboardData.allTimeStats

    const plusMinusData: UserSeasonStats[] = selectedSeasonStats.map((stat) => ({
        userId: stat.userId,
        userName: userNameById.get(stat.userId) ?? `User ${stat.userId}`,
        totalPlus: stat.totalPlus,
        totalMinus: stat.totalMinus,
        earnings: 0,
    }))

    const rosterScorersData: RosterScorerByUser[] = selectedSeasonId
        ? safeDashboardData.rosterScorers
            .filter((scorer) => scorer.seasonId === selectedSeasonId)
            .map((scorer) => ({
                rosterPlayerId: scorer.rosterPlayerId,
                firstName: scorer.firstName,
                surname: scorer.surname,
                teamShortName: null,
                totalCount: scorer.totalCount,
                userCounts: scorer.userCounts,
            }))
        : safeDashboardData.allTimeRosterScorers.map((scorer) => ({
            rosterPlayerId: scorer.rosterPlayerId,
            firstName: scorer.firstName,
            surname: scorer.surname,
            teamShortName: null,
            totalCount: scorer.totalCount,
            userCounts: scorer.userCounts,
        }))

    const rosterPenalizedData: RosterPenalizedByUser[] = selectedSeasonId
        ? safeDashboardData.rosterPenalized
            .filter((penalized) => penalized.seasonId === selectedSeasonId)
            .map((penalized) => ({
                rosterPlayerId: penalized.rosterPlayerId,
                firstName: penalized.firstName,
                surname: penalized.surname,
                teamShortName: null,
                totalCount: penalized.totalCount,
                userCounts: penalized.userCounts,
            }))
        : safeDashboardData.allTimeRosterPenalized.map((penalized) => ({
            rosterPlayerId: penalized.rosterPlayerId,
            firstName: penalized.firstName,
            surname: penalized.surname,
            teamShortName: null,
            totalCount: penalized.totalCount,
            userCounts: penalized.userCounts,
        }))

    const trendData = selectedSeasonId
        ? safeDashboardData.trendData
        : safeDashboardData.allTimePlusMinusTrend

    return (
        <div className="min-h-screen bg-bg text-text p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <h1 className="text-2xl font-bold text-primary">{t('dashboard.title')}</h1>
                    {seasons.length > 0 && (
                        <SeasonSelector
                            seasons={seasons}
                            selectedId={selectedSeasonId}
                            onChange={handleSeasonChange}
                        />
                    )}
                </div>

                {/* Season-specific charts (2-column grid) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    {/* Plus / Minus */}
                    <section className="card p-5">
                        <h2 className="text-sm font-semibold text-primary mb-3">{t('dashboard.plusMinusByPlayer')}</h2>
                        {loadingDashboard ? (
                            <LoadingSpinner size="sm" inline />
                        ) : (
                            <PlusMinusChart data={plusMinusData} />
                        )}
                    </section>

                    {/* Earnings */}
                    <section className="card p-5" data-testid="earnings-section">
                        <h2 className="text-sm font-semibold text-primary mb-3">
                            {selectedSeasonId ? t('dashboard.seasonEarnings') : t('dashboard.allTimeEarnings')}
                        </h2>
                        <EarningsChart
                            data={safeDashboardData.earningsBySeason}
                            selectedSeasonId={selectedSeasonId}
                            users={users}
                            seasons={seasons}
                        />
                        {!selectedSeasonId && safeDashboardData.allTimeEarnings && (
                            <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-center">
                                <div className="bg-bg rounded-lg p-2 border border-border">
                                    <p className="text-text-muted">{t('dashboard.collected')}</p>
                                    <p className="text-success font-semibold">
                                        {safeDashboardData.allTimeEarnings.totalCollected.toFixed(2)} €
                                    </p>
                                </div>
                                <div className="bg-bg rounded-lg p-2 border border-border">
                                    <p className="text-text-muted">{t('dashboard.expenses')}</p>
                                    <p className="text-danger font-semibold">
                                        {safeDashboardData.allTimeEarnings.totalExpenses.toFixed(2)} €
                                    </p>
                                </div>
                                <div className="bg-bg rounded-lg p-2 border border-border">
                                    <p className="text-text-muted">{t('dashboard.canBeCollected')}</p>
                                    <p className={`font-semibold ${safeDashboardData.allTimeEarnings.canBeCollected > 100 ? 'text-danger' :
                                        safeDashboardData.allTimeEarnings.canBeCollected > 20 ? 'text-warning' : 'text-success'}`}>
                                        {safeDashboardData.allTimeEarnings.canBeCollected.toFixed(2)} €
                                    </p>
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Top Scorers */}
                    {(loadingDashboard || rosterScorersData.length > 0) && (
                        <section className="card p-5">
                            <h2 className="text-sm font-semibold text-primary mb-3">{t('dashboard.topScorers')}</h2>
                            {loadingDashboard ? (
                                <LoadingSpinner size="sm" inline />
                            ) : (
                                <TopScorersChart data={rosterScorersData} />
                            )}
                        </section>
                    )}

                    {/* Penalty Leaders */}
                    {(loadingDashboard || rosterPenalizedData.length > 0) && (
                        <section className="card p-5">
                            <h2 className="text-sm font-semibold text-primary mb-3">{t('dashboard.penaltyLeaders')}</h2>
                            {loadingDashboard ? (
                                <LoadingSpinner size="sm" inline />
                            ) : (
                                <PenaltyLeadersChart data={rosterPenalizedData} />
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
                        {loadingDashboard ? (
                            <LoadingSpinner size="sm" inline />
                        ) : (
                            <TrendChart data={trendData} mode="plus" totalPeriodMatches={trendData[0]?.totalPeriodMatches} />
                        )}
                    </section>
                    <section className="card p-5">
                        <h2 className="text-sm font-semibold text-primary mb-3">
                            {t('dashboard.minusTrend')} {selectedSeasonId ? t('dashboard.byWeek') : t('dashboard.bySeason')}
                        </h2>
                        {loadingDashboard ? (
                            <LoadingSpinner size="sm" inline />
                        ) : (
                            <TrendChart data={trendData} mode="minus" totalPeriodMatches={trendData[0]?.totalPeriodMatches} />
                        )}
                    </section>
                </div>
            </div>
        </div>
    )
}
