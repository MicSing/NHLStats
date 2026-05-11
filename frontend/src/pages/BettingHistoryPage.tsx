import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import LoadingSpinner from '../components/LoadingSpinner'
import PageLayout from '../components/PageLayout'
import { useAuth } from '../context/AuthContext'
import { bettingService } from '../services/bettingService'
import type { BetHistoryItem } from '../types/bet'

function formatDate(value: string | null): string {
    if (!value) return '—'
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

export default function BettingHistoryPage() {
    const { t } = useTranslation()
    const { user } = useAuth()
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState(false)
    const [items, setItems] = useState<BetHistoryItem[]>([])

    const userId = user?.userId ?? null

    useEffect(() => {
        if (!userId) {
            setLoading(false)
            return
        }

        bettingService
            .getHistory()
            .then((data) => {
                setItems(data)
                setLoadError(false)
            })
            .catch(() => setLoadError(true))
            .finally(() => setLoading(false))
    }, [userId])

    const totalStake = useMemo(() => items.reduce((sum, i) => sum + i.amount, 0), [items])
    const totalWon = useMemo(
        () => items.filter(i => i.status === 'Won').reduce((sum, i) => sum + (i.wonAmount ?? 0), 0),
        [items],
    )

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
                    <div className="flex gap-3">
                        <div className="text-xs text-text-muted bg-surface border border-border rounded-full px-3 py-1.5">
                            {t('betting.historySummary', { count: items.length, amount: totalStake.toFixed(2) })}
                        </div>
                        {totalWon > 0 && (
                            <div className="text-xs bg-success/20 text-success border border-success/30 rounded-full px-3 py-1.5">
                                {t('betting.totalWon')}: {totalWon.toFixed(2)} €
                            </div>
                        )}
                    </div>
                </header>

                {items.length === 0 ? (
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
                                    <th className="text-right px-4 py-3">{t('betting.oddsLabel')}</th>
                                    <th className="text-left px-4 py-3">{t('betting.outcome')}</th>
                                    <th className="text-right px-4 py-3">{t('betting.wonAmountLabel')}</th>
                                    <th className="text-left px-4 py-3">{t('betting.placedAtColumn')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {items.map((item) => (
                                    <tr key={item.id} className="bg-bg hover:bg-surface transition-colors">
                                        <td className="px-4 py-3">
                                            <p className="font-medium">
                                                {item.homeTeamName} vs {item.awayTeamName}
                                            </p>
                                            <p className="text-xs text-text-muted">
                                                {t('betting.matchNumber', { number: item.matchNumber })}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="font-medium">{item.betTargetName ?? '—'}</p>
                                            <p className="text-xs text-text-muted">{item.betType}</p>
                                        </td>
                                        <td className="px-4 py-3 text-right">{item.amount.toFixed(2)} €</td>
                                        <td className="px-4 py-3 text-right text-text-muted">×{item.odds.toFixed(2)}</td>
                                        <td className="px-4 py-3">
                                            <span
                                                className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                                                    item.status === 'Won'
                                                        ? 'bg-success/20 text-success'
                                                        : item.status === 'Lost'
                                                            ? 'bg-danger/20 text-danger'
                                                            : item.status === 'Cancelled'
                                                                ? 'bg-border text-text-muted line-through'
                                                                : 'bg-border text-text-muted'
                                                }`}
                                            >
                                                {item.status === 'Won'
                                                    ? t('betting.outcomeWon')
                                                    : item.status === 'Lost'
                                                        ? t('betting.outcomeLost')
                                                        : item.status === 'Cancelled'
                                                            ? t('betting.outcomeCancelled')
                                                            : t('betting.outcomePending')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {item.wonAmount != null
                                                ? <span className="text-success font-medium">{item.wonAmount.toFixed(2)} €</span>
                                                : <span className="text-text-muted">—</span>}
                                        </td>
                                        <td className="px-4 py-3 text-text-muted text-xs">{formatDate(item.createdOn)}</td>
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
