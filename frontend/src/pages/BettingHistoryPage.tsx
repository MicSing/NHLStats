import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import LoadingSpinner from '../components/LoadingSpinner'
import PageLayout from '../components/PageLayout'
import { useAuth } from '../context/AuthContext'
import apiClient from '../services/apiClient'
import { cacheService } from '../services/cacheService'
import { bettingService } from '../services/bettingService'
import { CompletionType } from '../types/match'
import type { Match } from '../types/match'
import type { BetOutcome, UserBet } from '../types/bet'

interface HistoryRow {
    bet: UserBet
    outcome: BetOutcome
}

function formatMatchDate(matchDate: string | null): string {
    if (!matchDate) return 'TBD'

    const parsed = new Date(matchDate)
    return Number.isNaN(parsed.getTime()) ? 'TBD' : parsed.toLocaleString()
}

function resolveOutcome(bet: UserBet, match: Match | undefined): BetOutcome {
    if (!match || match.completionType === CompletionType.None) {
        return 'pending'
    }

    if (match.homeScore === match.awayScore) {
        return 'pending'
    }

    const winnerTeamId = match.homeScore > match.awayScore ? match.homeTeamId : match.awayTeamId
    return winnerTeamId === bet.selectedTeamId ? 'won' : 'lost'
}

export default function BettingHistoryPage() {
    const { t } = useTranslation()
    const { user } = useAuth()
    const [loading, setLoading] = useState(() => (user?.userId ?? null) !== null)
    const [loadError, setLoadError] = useState(false)
    const [rows, setRows] = useState<HistoryRow[]>([])

    const userId = user?.userId ?? null

    useEffect(() => {
        if (!userId) {
            return
        }

        let isMounted = true

        const bets = bettingService.getUserBets(userId)

        cacheService
            .getSeasons()
            .then(async (seasons) => {
                const seasonMatches = await Promise.all(
                    seasons.map(async (season) => {
                        try {
                            const matches = await apiClient.get<Match[]>(`/api/seasons/${season.id}/matches`)
                            return matches
                        } catch {
                            return [] as Match[]
                        }
                    }),
                )

                if (!isMounted) return

                const byId = new Map<number, Match>()
                for (const matches of seasonMatches) {
                    for (const match of matches) {
                        byId.set(match.id, match)
                    }
                }

                const resolved: HistoryRow[] = bets.map((bet) => ({
                    bet,
                    outcome: resolveOutcome(bet, byId.get(bet.matchId)),
                }))

                setRows(resolved)
                setLoadError(false)
            })
            .catch(() => {
                if (!isMounted) return
                setLoadError(true)
            })
            .finally(() => {
                if (!isMounted) return
                setLoading(false)
            })

        return () => {
            isMounted = false
        }
    }, [userId])

    const totalStake = useMemo(() => rows.reduce((sum, row) => sum + row.bet.stake, 0), [rows])

    const removeBet = (betId: string) => {
        bettingService.removeBet(betId)
        setRows((prev) => prev.filter((row) => row.bet.id !== betId))
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-bg text-text flex items-center justify-center">
                <LoadingSpinner />
            </div>
        )
    }

    if (loadError) {
        return (
            <PageLayout>
                <div className="max-w-5xl mx-auto card p-6 text-center">
                    <h1 className="text-2xl font-bold text-primary mb-2">{t('betting.historyTitle')}</h1>
                    <p className="text-text-muted">{t('betting.loadError')}</p>
                </div>
            </PageLayout>
        )
    }

    if (!userId) {
        return (
            <PageLayout>
                <div className="max-w-5xl mx-auto card p-6 text-center">
                    <h1 className="text-2xl font-bold text-primary mb-2">{t('betting.historyTitle')}</h1>
                    <p className="text-text-muted">{t('betting.userIdMissing')}</p>
                </div>
            </PageLayout>
        )
    }

    return (
        <PageLayout>
            <div className="max-w-5xl mx-auto space-y-6">
                <header className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-primary">{t('betting.historyTitle')}</h1>
                        <p className="text-sm text-text-muted mt-1">{t('betting.historySubtitle')}</p>
                    </div>
                    <div className="text-xs text-text-muted bg-surface border border-border rounded-full px-3 py-1.5">
                        {t('betting.historySummary', { count: rows.length, amount: totalStake.toFixed(2) })}
                    </div>
                </header>

                {rows.length === 0 ? (
                    <section className="card p-6 text-center">
                        <p className="text-text-muted">{t('betting.noBetHistory')}</p>
                    </section>
                ) : (
                    <section className="overflow-x-auto rounded-xl border border-border">
                        <table className="w-full text-sm" aria-label={t('betting.historyTable')}>
                            <thead className="bg-surface text-text-muted uppercase text-xs tracking-wider">
                                <tr>
                                    <th className="text-left px-4 py-3">{t('betting.match')}</th>
                                    <th className="text-left px-4 py-3">{t('betting.pick')}</th>
                                    <th className="text-right px-4 py-3">{t('betting.stakeLabel')}</th>
                                    <th className="text-left px-4 py-3">{t('betting.outcome')}</th>
                                    <th className="text-left px-4 py-3">{t('betting.placedAtColumn')}</th>
                                    <th className="text-right px-4 py-3">{t('common.actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {rows.map(({ bet, outcome }) => (
                                    <tr key={bet.id} className="bg-bg hover:bg-surface transition-colors">
                                        <td className="px-4 py-3">
                                            <p className="font-medium">{bet.homeTeamName} vs {bet.awayTeamName}</p>
                                            <p className="text-xs text-text-muted">
                                                {bet.seasonName} - {t('betting.matchNumber', { number: bet.matchNumber })} - {formatMatchDate(bet.matchDate)}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3 font-medium">{bet.selectedTeamName}</td>
                                        <td className="px-4 py-3 text-right">{bet.stake.toFixed(2)} €</td>
                                        <td className="px-4 py-3">
                                            <span
                                                className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${outcome === 'won'
                                                    ? 'bg-success/20 text-success'
                                                    : outcome === 'lost'
                                                        ? 'bg-danger/20 text-danger'
                                                        : 'bg-border text-text-muted'
                                                    }`}
                                            >
                                                {outcome === 'won' ? t('betting.outcomeWon') : outcome === 'lost' ? t('betting.outcomeLost') : t('betting.outcomePending')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-text-muted">{new Date(bet.placedAt).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                type="button"
                                                className="btn-ghost text-xs"
                                                onClick={() => removeBet(bet.id)}
                                            >
                                                {t('betting.removeBet')}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                )}
            </div>
        </PageLayout>
    )
}
