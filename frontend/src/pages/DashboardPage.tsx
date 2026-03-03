import { useEffect, useState } from 'react'
import type { Season } from '../types/season'
import type { UserSeasonStats, AllTimeEarnings, TopRosterPlayer } from '../types/stats'
import apiClient from '../services/apiClient'
import SeasonSelector from '../components/SeasonSelector'
import PlusMinusChart from '../components/charts/PlusMinusChart'
import TopScorersChart from '../components/charts/TopScorersChart'
import PenaltyLeadersChart from '../components/charts/PenaltyLeadersChart'
import EarningsChart from '../components/charts/EarningsChart'

export default function DashboardPage() {
    const [seasons, setSeasons] = useState<Season[]>([])
    const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null)
    const [seasonStats, setSeasonStats] = useState<UserSeasonStats[]>([])
    const [rosterScorers, setRosterScorers] = useState<TopRosterPlayer[]>([])
    const [rosterPenalized, setRosterPenalized] = useState<TopRosterPlayer[]>([])
    const [allTimeEarnings, setAllTimeEarnings] = useState<AllTimeEarnings | null>(null)
    const [loadingSeasons, setLoadingSeasons] = useState(true)
    const [loadingStats, setLoadingStats] = useState(false)

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

    // Load per-season stats when a season is selected
    useEffect(() => {
        if (!selectedSeasonId) {
            setSeasonStats([])
            setRosterScorers([])
            setRosterPenalized([])
            return
        }
        setLoadingStats(true)
        Promise.all([
            apiClient.get<UserSeasonStats[]>(`/api/seasons/${selectedSeasonId}/stats`),
            apiClient
                .get<TopRosterPlayer[]>(`/api/seasons/${selectedSeasonId}/stats/roster-scorers`)
                .catch(() => [] as TopRosterPlayer[]),
            apiClient
                .get<TopRosterPlayer[]>(`/api/seasons/${selectedSeasonId}/stats/roster-penalized`)
                .catch(() => [] as TopRosterPlayer[]),
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
    }, [selectedSeasonId])

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <h1 className="text-2xl font-bold text-cyan-400">Dashboard</h1>
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
                    <section className="bg-gray-800 rounded-lg p-4">
                        <h2 className="text-sm font-semibold text-cyan-300 mb-3">Plus / Minus by Player</h2>
                        {loadingStats ? (
                            <p className="text-gray-400 text-sm text-center py-8">Loading…</p>
                        ) : (
                            <PlusMinusChart data={seasonStats} />
                        )}
                    </section>

                    {/* Top Scorers */}
                    <section className="bg-gray-800 rounded-lg p-4">
                        <h2 className="text-sm font-semibold text-cyan-300 mb-3">Top Scorers (In-Game Players)</h2>
                        {loadingStats ? (
                            <p className="text-gray-400 text-sm text-center py-8">Loading…</p>
                        ) : (
                            <TopScorersChart data={rosterScorers} />
                        )}
                    </section>

                    {/* Penalty Leaders */}
                    <section className="bg-gray-800 rounded-lg p-4">
                        <h2 className="text-sm font-semibold text-cyan-300 mb-3">Penalty Leaders (In-Game Players)</h2>
                        {loadingStats ? (
                            <p className="text-gray-400 text-sm text-center py-8">Loading…</p>
                        ) : (
                            <PenaltyLeadersChart data={rosterPenalized} />
                        )}
                    </section>

                    {/* All-Time Earnings */}
                    <section className="bg-gray-800 rounded-lg p-4" data-testid="earnings-section">
                        <h2 className="text-sm font-semibold text-cyan-300 mb-3">All-Time Earnings</h2>
                        {allTimeEarnings ? (
                            <>
                                <EarningsChart data={allTimeEarnings.userEarnings} />
                                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-center">
                                    <div className="bg-gray-700 rounded p-2">
                                        <p className="text-gray-400">Collected</p>
                                        <p className="text-green-400 font-semibold">
                                            {allTimeEarnings.totalCollected.toFixed(2)} €
                                        </p>
                                    </div>
                                    <div className="bg-gray-700 rounded p-2">
                                        <p className="text-gray-400">Expenses</p>
                                        <p className="text-red-400 font-semibold">
                                            {allTimeEarnings.totalExpenses.toFixed(2)} €
                                        </p>
                                    </div>
                                    <div className="bg-gray-700 rounded p-2">
                                        <p className="text-gray-400">Balance</p>
                                        <p className={`font-semibold ${allTimeEarnings.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
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
            </div>
        </div>
    )
}
