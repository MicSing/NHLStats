import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import LoadingSpinner from '../components/LoadingSpinner'
import PageLayout from '../components/PageLayout'
import type { FinancialStats } from '../types/stats'
import type { Expense } from '../types/expense'
import apiClient from '../services/apiClient'
import { cacheService } from '../services/cacheService'

function formatCurrency(value: number): string {
    const abs = Math.abs(value)
    const str = `${abs.toFixed(2)} €`
    return value < 0 ? `-${str}` : str
}

function formatDate(dateStr: string): string {
    return dateStr.split('T')[0]
}

export default function FinancePage() {
    const { t } = useTranslation()
    const [stats, setStats] = useState<FinancialStats | null>(null)
    const [expenses, setExpenses] = useState<Expense[]>([])
    const [userNames, setUserNames] = useState<Record<number, string>>({})
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        Promise.all([
            apiClient.get<FinancialStats>('/api/stats/financial-stats'),
            cacheService.getUsers(),
        ])
            .then(([response, users]) => {
                setStats(response)
                setExpenses(response.expenses ?? [])
                setUserNames(
                    users.reduce<Record<number, string>>((acc, user) => {
                        acc[user.id] = user.name
                        return acc
                    }, {})
                )
            })
            .catch(() => { })
            .finally(() => setLoading(false))
    }, [])

    if (loading) {
        return (
            <div className="min-h-screen bg-bg text-text flex items-center justify-center">
                <LoadingSpinner />
            </div>
        )
    }

    const users = stats?.financesByUser ?? []
    const totalNegativeCash = users.reduce((s, u) => s + u.negativeCash, 0)
    const expensesTotal = expenses.reduce((s, e) => s + e.amount, 0)

    return (
        <PageLayout>
            <div className="max-w-5xl mx-auto space-y-8">
                <h1 className="text-2xl font-bold text-primary">{t('earnings.title')}</h1>

                {/* ── Earnings Table ──────────────────────────────────── */}
                <section>
                    <h2 className="text-lg font-semibold text-primary mb-3">{t('earnings.playerEarnings')}</h2>
                    <div className="overflow-x-auto rounded-xl border border-border">
                        <table
                            className="w-full text-sm"
                            aria-label="Earnings"
                            data-testid="earnings-table"
                        >
                            <thead className="bg-surface text-text-muted uppercase text-xs tracking-wider">
                                <tr>
                                    <th className="text-left px-4 py-3">{t('earnings.player')}</th>
                                    <th className="text-right px-4 py-3">
                                        {t('earnings.dues')} <span className="opacity-50 normal-case">ℹ</span>
                                    </th>
                                    <th className="text-right px-4 py-3 border-l border-border">
                                        {t('earnings.betBalance')} <span className="opacity-50 normal-case">ℹ</span>
                                    </th>
                                    <th className="text-right px-4 py-3 border-l border-border">{t('earnings.paid')}</th>
                                    <th className="text-right px-4 py-3 border-l border-border">{t('earnings.canBeCollected')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {users.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-6 text-text-muted">
                                            {t('earnings.noFinancialData')}
                                        </td>
                                    </tr>
                                ) : (
                                    users.map((u) => (
                                        <tr key={u.userId} className="bg-bg hover:bg-surface transition-colors">
                                            <td className="px-4 py-3 font-medium">{userNames[u.userId] ?? `User ${u.userId}`}</td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="relative group inline-block cursor-default">
                                                    <span className="font-medium text-danger">{formatCurrency(u.negativeCash)}</span>
                                                    <div className="absolute right-0 top-full mt-1 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                                        <div className="bg-surface border border-border rounded shadow-lg px-3 py-2 text-xs whitespace-nowrap text-left">
                                                            <div className="flex gap-3 justify-between">
                                                                <span className="text-text-muted">{t('earnings.minusPoints')}</span>
                                                                <span className="font-mono">{u.totalMinuses}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right border-l border-border">
                                                <div className="relative group inline-block cursor-default">
                                                    <span className="font-medium text-primary">{formatCurrency(u.bettingBalance)}</span>
                                                    <div className="absolute right-0 top-full mt-1 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                                        <div className="bg-surface border border-border rounded shadow-lg px-3 py-2 text-xs whitespace-nowrap text-left space-y-1">
                                                            <div className="flex gap-3 justify-between">
                                                                <span className="text-text-muted">{t('earnings.plusPoints')}</span>
                                                                <span className="font-mono">{u.totalPluses}</span>
                                                            </div>
                                                            <div className="flex gap-3 justify-between">
                                                                <span className="text-text-muted">{t('earnings.stakes')}</span>
                                                                <span className="font-mono">{u.stakes > 0 ? formatCurrency(u.stakes) : '—'}</span>
                                                            </div>
                                                            <div className="flex gap-3 justify-between">
                                                                <span className="text-text-muted">{t('earnings.betWins')}</span>
                                                                <span className="font-mono text-success">{u.betWins > 0 ? formatCurrency(u.betWins) : '—'}</span>
                                                            </div>
                                                            <div className="flex gap-3 justify-between">
                                                                <span className="text-text-muted">{t('earnings.betLosses')}</span>
                                                                <span className="font-mono text-danger">{u.betLosses > 0 ? formatCurrency(u.betLosses) : '—'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right text-text-muted border-l border-border">
                                                {u.collected > 0 ? formatCurrency(u.collected) : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium text-warning border-l border-border">
                                                {formatCurrency(u.canBeCollected)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            {users.length > 0 && (
                                <tfoot className="bg-surface border-t-2 border-border font-semibold text-sm">
                                    <tr>
                                        <td className="px-4 py-3 text-text">{t('earnings.total')}</td>
                                        <td className="px-4 py-3 text-right text-danger">{formatCurrency(totalNegativeCash)}</td>
                                        <td className="px-4 py-3 border-l border-border" />
                                        <td className="px-4 py-3 text-right text-text-muted border-l border-border">{formatCurrency(stats?.totalExpenses ?? 0)}</td>
                                        <td className={`px-4 py-3 text-right border-l border-border ${(stats?.canBeCollected ?? 0) > 0 ? 'text-warning' : 'text-success'}`}>
                                            {formatCurrency(stats?.canBeCollected ?? 0)}
                                        </td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </section>

                {/* ── Expenses Table ───────────────────────────────────── */}
                <section>
                    <h2 className="text-lg font-semibold text-primary mb-3">{t('earnings.groupExpenses')}</h2>
                    <div className="overflow-x-auto rounded-xl border border-border">
                        <table
                            className="w-full text-sm"
                            aria-label="Expenses"
                            data-testid="expenses-table"
                        >
                            <thead className="bg-surface text-text-muted uppercase text-xs tracking-wider">
                                <tr>
                                    <th className="text-left px-4 py-3">{t('earnings.description')}</th>
                                    <th className="text-right px-4 py-3">{t('earnings.amount')}</th>
                                    <th className="text-left px-4 py-3">{t('earnings.date')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {expenses.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="text-center py-6 text-text-muted">
                                            {t('earnings.noExpenses')}
                                        </td>
                                    </tr>
                                ) : (
                                    expenses.map((e) => (
                                        <tr key={e.id} className="bg-bg hover:bg-surface transition-colors">
                                            <td className="px-4 py-3">{e.description ?? '—'}</td>
                                            <td className="px-4 py-3 text-right text-warning">
                                                {formatCurrency(e.amount)}
                                            </td>
                                            <td className="px-4 py-3 text-text-muted">{formatDate(e.date)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            {expenses.length > 0 && (
                                <tfoot className="bg-surface border-t-2 border-border font-semibold text-sm">
                                    <tr>
                                        <td className="px-4 py-3 text-text">{t('earnings.total')}</td>
                                        <td className="px-4 py-3 text-right text-warning">
                                            {formatCurrency(expensesTotal)}
                                        </td>
                                        <td />
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </section>

                {/* ── Balance Summary ───────────────────────────────────── */}
                {stats && (
                    <section
                        className="card p-6"
                        data-testid="balance-summary"
                    >
                        <h2 className="text-lg font-semibold text-primary mb-4">{t('earnings.balanceSummary')}</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="bg-bg rounded-lg border border-border p-4 text-center">
                                <p className="text-xs text-text-muted uppercase tracking-wider mb-1">
                                    {t('earnings.canBeCollected')}
                                </p>
                                <p className={`text-2xl font-bold ${(stats.canBeCollected ?? 0) > 0 ? 'text-danger' : 'text-success'}`}>
                                    {formatCurrency(stats.canBeCollected)}
                                </p>
                            </div>
                            <div className="bg-bg rounded-lg border border-border p-4 text-center">
                                <p className="text-xs text-text-muted uppercase tracking-wider mb-1">
                                    {t('earnings.totalCollected')}
                                </p>
                                <p className="text-2xl font-bold text-success">
                                    {formatCurrency(stats.totalCollected)}
                                </p>
                            </div>
                            <div className="bg-bg rounded-lg border border-border p-4 text-center">
                                <p className="text-xs text-text-muted uppercase tracking-wider mb-1">
                                    {t('earnings.totalExpenses')}
                                </p>
                                <p className="text-2xl font-bold text-warning">
                                    {formatCurrency(stats.totalExpenses)}
                                </p>
                            </div>
                        </div>
                    </section>
                )}
            </div>
        </PageLayout>
    )
}
