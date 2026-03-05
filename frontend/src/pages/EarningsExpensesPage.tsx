import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AllTimeEarnings } from '../types/stats'
import type { Expense } from '../types/expense'
import apiClient from '../services/apiClient'

function formatCurrency(value: number): string {
    const abs = Math.abs(value)
    const str = `${abs.toFixed(2)} €`
    return value < 0 ? `-${str}` : str
}

function formatDate(dateStr: string): string {
    return dateStr.split('T')[0]
}

export default function EarningsExpensesPage() {
    const { t } = useTranslation()
    const [earnings, setEarnings] = useState<AllTimeEarnings | null>(null)
    const [expenses, setExpenses] = useState<Expense[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        Promise.all([
            apiClient.get<AllTimeEarnings>('/api/stats/earnings'),
            apiClient.get<Expense[]>('/api/expenses'),
        ])
            .then(([e, ex]) => {
                setEarnings(e)
                setExpenses(ex)
            })
            .catch(() => { })
            .finally(() => setLoading(false))
    }, [])

    if (loading) {
        return (
            <div className="min-h-screen bg-bg text-text flex items-center justify-center">
                <p className="text-text-muted">{t('common.loading')}</p>
            </div>
        )
    }

    const users = earnings?.userEarnings ?? []
    const totalPlus = users.reduce((s, u) => s + u.totalPlus, 0)
    const totalMinus = users.reduce((s, u) => s + u.totalMinus, 0)
    const expensesTotal = expenses.reduce((s, e) => s + e.amount, 0)

    return (
        <div className="min-h-screen bg-bg text-text p-6">
            <div className="max-w-5xl mx-auto space-y-8">
                <h1 className="text-2xl font-bold text-primary">{t('earnings.title')}</h1>

                {/* ── Earnings Table ──────────────────────────────────── */}
                <section>
                    <h2 className="text-lg font-semibold text-primary mb-3">{t('earnings.playerBalance')}</h2>
                    <div className="overflow-x-auto rounded-xl border border-border">
                        <table
                            className="w-full text-sm"
                            aria-label="Earnings"
                            data-testid="earnings-table"
                        >
                            <thead className="bg-surface text-text-muted uppercase text-xs tracking-wider">
                                <tr>
                                    <th className="text-left px-4 py-3">{t('earnings.player')}</th>
                                    <th className="text-right px-4 py-3">{t('earnings.plusPoints')}</th>
                                    <th className="text-right px-4 py-3">{t('earnings.minusPoints')}</th>
                                    <th className="text-right px-4 py-3">{t('earnings.paid')}</th>
                                    <th className="text-right px-4 py-3">{t('earnings.balance')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {users.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-6 text-text-muted">
                                            {t('earnings.noBalanceData')}
                                        </td>
                                    </tr>
                                ) : (
                                    users.map((u) => (
                                        <tr key={u.userId} className="bg-bg hover:bg-surface transition-colors">
                                            <td className="px-4 py-3 font-medium">{u.userName}</td>
                                            <td className="px-4 py-3 text-right text-success">{u.totalPlus}</td>
                                            <td className="px-4 py-3 text-right text-danger">{u.totalMinus}</td>
                                            <td className="px-4 py-3 text-right text-text-muted">
                                                {u.totalPaid > 0 ? formatCurrency(u.totalPaid) : '—'}
                                            </td>
                                            <td className={`px-4 py-3 text-right font-medium ${u.remainingBalance > 0 ? 'text-danger' : 'text-success'}`}>
                                                {formatCurrency(u.remainingBalance)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            {users.length > 0 && (
                                <tfoot className="bg-surface border-t-2 border-border font-semibold text-sm">
                                    <tr>
                                        <td className="px-4 py-3 text-text">{t('earnings.total')}</td>
                                        <td className="px-4 py-3 text-right text-success">{totalPlus}</td>
                                        <td className="px-4 py-3 text-right text-danger">{totalMinus}</td>
                                        <td className="px-4 py-3 text-right text-text-muted">{formatCurrency(earnings?.totalCollected ?? 0)}</td>
                                        <td className={`px-4 py-3 text-right ${(earnings?.canBeCollected ?? 0) > 0 ? 'text-danger' : 'text-success'}`}>
                                            {formatCurrency(earnings?.canBeCollected ?? 0)}
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
                {earnings && (
                    <section
                        className="card p-6"
                        data-testid="balance-summary"
                    >
                        <h2 className="text-lg font-semibold text-primary mb-4">{t('earnings.balanceSummary')}</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-bg rounded-lg border border-border p-4 text-center">
                                <p className="text-xs text-text-muted uppercase tracking-wider mb-1">
                                    {t('earnings.canBeCollected')}
                                </p>
                                <p className={`text-2xl font-bold ${(earnings.canBeCollected ?? 0) > 0 ? 'text-danger' : 'text-success'}`}>
                                    {formatCurrency(earnings.canBeCollected)}
                                </p>
                            </div>
                            <div className="bg-bg rounded-lg border border-border p-4 text-center">
                                <p className="text-xs text-text-muted uppercase tracking-wider mb-1">
                                    {t('earnings.totalCollected')}
                                </p>
                                <p className="text-2xl font-bold text-success">
                                    {formatCurrency(earnings.totalCollected)}
                                </p>
                            </div>
                            <div className="bg-bg rounded-lg border border-border p-4 text-center">
                                <p className="text-xs text-text-muted uppercase tracking-wider mb-1">
                                    {t('earnings.totalExpenses')}
                                </p>
                                <p className="text-2xl font-bold text-warning">
                                    {formatCurrency(earnings.totalExpenses)}
                                </p>
                            </div>
                            <div className="bg-bg rounded-lg border border-border p-4 text-center">
                                <p className="text-xs text-text-muted uppercase tracking-wider mb-1">{t('earnings.remaining')}</p>
                                <p
                                    className={`text-2xl font-bold ${earnings.balance >= 0 ? 'text-success' : 'text-danger'
                                        }`}
                                >
                                    {formatCurrency(earnings.balance)}
                                </p>
                            </div>
                        </div>
                    </section>
                )}
            </div>
        </div>
    )
}
